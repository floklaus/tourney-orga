import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { DeliverySchedulerService } from '../src/modules/delivery/delivery-scheduler.service';
import {
  MAIL_TRANSPORT,
  MailTransport,
  OutgoingMail,
} from '../src/modules/mail/mail-transport';

export const ADMIN = {
  email: 'admin@example.com',
  password: 'admin-password-123',
};

/** Records outgoing mail; `failWith` makes the next sends throw. */
export class FakeMailTransport implements MailTransport {
  sent: OutgoingMail[] = [];
  failures: Array<Record<string, unknown>> = [];
  private counter = 0;

  send(mail: OutgoingMail): Promise<{ messageId: string }> {
    const failure = this.failures.shift();
    if (failure) {
      return Promise.reject(Object.assign(new Error('SMTP failure'), failure));
    }
    this.sent.push(mail);
    return Promise.resolve({ messageId: `<msg-${++this.counter}@test>` });
  }

  verify(): Promise<void> {
    return Promise.resolve();
  }

  failNext(...failures: Array<Record<string, unknown>>): void {
    this.failures.push(...failures);
  }

  reset(): void {
    this.sent = [];
    this.failures = [];
  }

  lastTo(address: string): OutgoingMail | undefined {
    return [...this.sent].reverse().find((m) => m.to === address);
  }
}

export interface TestContext {
  app: INestApplication;
  mail: FakeMailTransport;
  dataSource: DataSource;
  scheduler: DeliverySchedulerService;
}

export async function createTestApp(): Promise<TestContext> {
  const mail = new FakeMailTransport();
  const setup = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
  });
  await setup.initialize();
  await setup.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await setup.destroy();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
  await app.init();
  return {
    app,
    mail,
    dataSource,
    scheduler: app.get(DeliverySchedulerService),
  };
}

/** Logged-in agent that sends the CSRF header automatically. */
export class Client {
  private csrf = '';

  constructor(readonly agent: TestAgent) {}

  static async login(
    app: INestApplication,
    credentials = ADMIN,
  ): Promise<Client> {
    const client = new Client(request.agent(app.getHttpServer()));
    const res = await client.agent
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(200);
    client.readCsrf(res.headers['set-cookie'] as unknown as string[]);
    return client;
  }

  readCsrf(cookies: string[] | undefined): void {
    const cookie = (cookies ?? []).find((c) => c.startsWith('csrf_token='));
    if (cookie) this.csrf = cookie.split(';')[0].split('=')[1];
  }

  get(url: string) {
    return this.agent.get(`/api/v1${url}`);
  }

  post(url: string, body?: object) {
    return this.agent
      .post(`/api/v1${url}`)
      .set('X-CSRF-Token', this.csrf)
      .send(body);
  }

  patch(url: string, body?: object) {
    return this.agent
      .patch(`/api/v1${url}`)
      .set('X-CSRF-Token', this.csrf)
      .send(body);
  }

  put(url: string, body?: object) {
    return this.agent
      .put(`/api/v1${url}`)
      .set('X-CSRF-Token', this.csrf)
      .send(body);
  }

  delete(url: string) {
    return this.agent.delete(`/api/v1${url}`).set('X-CSRF-Token', this.csrf);
  }
}

export function extractLink(html: string, pathPrefix: string): string {
  const match = new RegExp(`${pathPrefix}/([A-Za-z0-9_-]+)`).exec(html);
  if (!match) throw new Error(`No ${pathPrefix} link in email`);
  return match[1];
}

let helperSeq = 0;

export interface SentStep {
  id: string;
  participationId: string;
  teamId: string;
}

export interface SentEmails {
  tournamentId: string;
  steps: SentStep[];
}

/**
 * Creates a tournament (with the given variables) and a participation per team, gives each
 * participation one email (template with subject/body), sends it now and runs one scheduler tick.
 */
export async function sendStepNow(
  admin: Client,
  scheduler: DeliverySchedulerService,
  opts: {
    teamIds: string[];
    subject?: string;
    bodyHtml?: string;
    variables?: Record<string, string>;
  },
): Promise<SentEmails> {
  const suffix = `${Date.now()}-${++helperSeq}`;
  const template = (
    await admin
      .post('/templates', {
        name: `Template ${suffix}`,
        subject: opts.subject ?? 'Update for {{team.name}}',
        bodyHtml: opts.bodyHtml ?? '<p>Hi {{team.contactName}}</p>',
      })
      .expect(201)
  ).body.data;
  const start = new Date(Date.now() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tournament = (
    await admin
      .post('/tournaments', {
        name: `Tournament ${suffix}`,
        startDate: start,
        endDate: start,
        variables: opts.variables ?? {},
      })
      .expect(201)
  ).body.data;
  const created = (
    await admin
      .post('/participations/bulk', {
        tournamentId: tournament.id,
        teamIds: opts.teamIds,
      })
      .expect(201)
  ).body.data.created as { id: string; team: { id: string } }[];
  const steps: SentStep[] = [];
  for (const p of created) {
    const step = (
      await admin
        .post(`/participations/${p.id}/steps`, {
          name: 'Email',
          templateId: template.id,
          timingType: 'ABSOLUTE',
          sendAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(201)
    ).body.data;
    await admin.post(`/steps/${step.id}/send-now`).expect(200);
    steps.push({ id: step.id, participationId: p.id, teamId: p.team.id });
  }
  await scheduler.tick();
  return { tournamentId: tournament.id, steps };
}

/** A participation's email step as returned by the API. */
export async function stepOf(admin: Client, sent: SentStep) {
  const steps = (
    await admin.get(`/participations/${sent.participationId}/steps`).expect(200)
  ).body.data as {
    id: string;
    status: string;
    delivery: { id: string; status: string } | null;
    missingVariables: string[];
  }[];
  return steps.find((s) => s.id === sent.id)!;
}
