import { DateTime } from 'luxon';
import request from 'supertest';
import { In } from 'typeorm';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../src/modules/delivery/email-delivery.entity';
import { EmailStep } from '../src/modules/email/email-step.entity';
import { Setting } from '../src/modules/settings/setting.entity';
import { Team } from '../src/modules/team/team.entity';
import {
  Client,
  createTestApp,
  extractLink,
  sendStepNow,
  TestContext,
} from './helpers';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const zone = 'Europe/Berlin';
const day = (offset: number) =>
  DateTime.now().setZone(zone).plus({ days: offset }).toISODate()!;

describe('Participation emails, scheduling & delivery (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  let templateId: string;
  const teamIds: string[] = [];

  const steps = () => ctx.dataSource.getRepository(EmailStep);
  const deliveries = () => ctx.dataSource.getRepository(EmailDelivery);
  const plan = (offsetDays: number, extra: Record<string, unknown> = {}) => ({
    name: `T${offsetDays}`,
    templateId,
    timingType: 'RELATIVE',
    offsetDays,
    timeOfDay: '09:00',
    anchor: 'START',
    ...extra,
  });

  async function tournamentWithTeams(
    startInDays: number,
    emailPlan: unknown[],
    variables = { venue: 'Hall 1' },
    teams = teamIds,
  ) {
    const t = (
      await admin
        .post('/tournaments', {
          name: `Cup ${Date.now()}`,
          startDate: day(startInDays),
          endDate: day(startInDays + 1),
          variables,
          emailPlan,
        })
        .expect(201)
    ).body.data;
    const created = (
      await admin
        .post('/participations/bulk', { tournamentId: t.id, teamIds: teams })
        .expect(201)
    ).body.data.created as { id: string; team: { name: string } }[];
    return { tournament: t, participations: created };
  }
  const stepsOf = async (participationId: string) =>
    (await admin.get(`/participations/${participationId}/steps`).expect(200))
      .body.data;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    for (const [name, email, cc] of [
      ['Alpha', 'alpha@t.test', ['coach@alpha.test']],
      ['Beta', 'beta@t.test', []],
      ['Gamma', 'gamma@t.test', []],
    ] as const) {
      teamIds.push(
        (
          await admin.post('/teams', {
            name,
            contactName: `${name} Contact`,
            email,
            ccEmails: cc,
          })
        ).body.data.id,
      );
    }
    await admin.patch('/settings', {
      organizerName: 'Org',
      senderName: 'Cup Org',
      replyToEmail: 'shared@org.test',
    });
    templateId = (
      await admin.post('/templates', {
        name: 'Reminder',
        subject: '{{tournament.name}}: see you at {{tournament.vars.venue}}',
        bodyHtml:
          '<p>Hi {{team.contactName}} ({{team.name}}), {{tournament.startDate}}</p>',
      })
    ).body.data.id;
  });

  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    ctx.mail.reset();
    await ctx.dataSource.getRepository(Setting).update(
      { id: 1 },
      {
        pausedUntil: null,
        pauseReason: null,
        dailyRecipientCap: 1000,
        ratePerMinute: 20,
      },
    );
    await ctx.dataSource.query(
      `UPDATE email_deliveries SET sent_at = now() - interval '2 days' WHERE sent_at IS NOT NULL`,
    );
    // Isolate tests: nothing queued by an earlier test may be sent in the next one.
    await ctx.dataSource.query(
      `UPDATE email_deliveries SET status = 'FAILED', locked_at = NULL WHERE status = 'QUEUED'`,
    );
    await ctx.dataSource.query(
      `UPDATE communication_steps SET status = 'CANCELLED' WHERE status IN ('SCHEDULED','PAUSED')`,
    );
  });

  it('copies the tournament email plan to each signed-up team with computed send times', async () => {
    const { tournament, participations } = await tournamentWithTeams(40, [
      plan(-14),
      plan(1, { anchor: 'END', timeOfDay: '18:00' }),
    ]);
    expect(tournament.emailPlan).toHaveLength(2);
    expect(tournament.emailPlan[0]).toMatchObject({
      id: expect.any(String),
      name: 'T-14',
      templateName: 'Reminder',
    });
    const list = await stepsOf(participations[0].id);
    expect(list.map((s: { name: string }) => s.name)).toEqual(['T-14', 'T1']);
    expect(
      DateTime.fromISO(list[0].resolvedSendAt)
        .setZone(zone)
        .toFormat('yyyy-MM-dd HH:mm'),
    ).toBe(`${day(26)} 09:00`);
    expect(
      DateTime.fromISO(list[1].resolvedSendAt)
        .setZone(zone)
        .toFormat('yyyy-MM-dd HH:mm'),
    ).toBe(`${day(42)} 18:00`);
    expect(list[0]).toMatchObject({
      status: 'SCHEDULED',
      planItemId: tournament.emailPlan[0].id,
      missingVariables: [],
    });
  });

  it('moves relative emails when the tournament dates change', async () => {
    const { tournament, participations } = await tournamentWithTeams(
      40,
      [plan(-14)],
      undefined,
      [teamIds[0]],
    );
    await admin
      .patch(`/tournaments/${tournament.id}`, {
        startDate: day(47),
        endDate: day(48),
      })
      .expect(200);
    const [moved] = await stepsOf(participations[0].id);
    expect(
      DateTime.fromISO(moved.resolvedSendAt).setZone(zone).toISODate(),
    ).toBe(day(33));
  });

  it('applies a changed plan to existing participations without duplicating emails', async () => {
    const { tournament, participations } = await tournamentWithTeams(
      40,
      [plan(-14)],
      undefined,
      [teamIds[0], teamIds[1]],
    );
    const current = tournament.emailPlan;
    await admin
      .patch(`/tournaments/${tournament.id}`, {
        emailPlan: [...current, plan(-2)],
      })
      .expect(200);
    expect(await stepsOf(participations[0].id)).toHaveLength(1);
    const res = await admin
      .post(`/tournaments/${tournament.id}/email-plan/apply`)
      .expect(200);
    expect(res.body.data).toEqual({ added: 2 });
    expect(await stepsOf(participations[0].id)).toHaveLength(2);
    expect(
      (
        await admin
          .post(`/tournaments/${tournament.id}/email-plan/apply`)
          .expect(200)
      ).body.data,
    ).toEqual({ added: 0 });
  });

  it('validates plan items', async () => {
    await admin
      .post('/tournaments', {
        name: 'X',
        startDate: day(10),
        endDate: day(10),
        emailPlan: [
          plan(-1, { templateId: '00000000-0000-4000-8000-000000000000' }),
        ],
      })
      .expect(422);
    await admin
      .post('/tournaments', {
        name: 'X',
        startDate: day(10),
        endDate: day(10),
        emailPlan: [plan(-1, { timeOfDay: '9am' })],
      })
      .expect(400);
  });

  it('sends due emails once per team with CC, headers and rendered content', async () => {
    const { participations } = await tournamentWithTeams(30, [plan(-2)]);
    const [alphaStep] = await stepsOf(
      participations.find((p) => p.team.name === 'Alpha')!.id,
    );
    const dueAt = new Date(new Date(alphaStep.resolvedSendAt).getTime() + 1000);
    await Promise.all([ctx.scheduler.tick(dueAt), ctx.scheduler.tick(dueAt)]);
    await ctx.scheduler.tick(dueAt);

    expect(ctx.mail.sent.map((m) => m.to).sort()).toEqual([
      'alpha@t.test',
      'beta@t.test',
      'gamma@t.test',
    ]);
    const alpha = ctx.mail.lastTo('alpha@t.test')!;
    expect(alpha).toMatchObject({
      from: '"Cup Org" <organizer@example.com>',
      cc: ['coach@alpha.test'],
      replyTo: 'shared@org.test',
      subject: expect.stringMatching(/^Cup \d+: see you at Hall 1$/),
    });
    expect(alpha.html).toContain('Hi Alpha Contact (Alpha)');
    expect(alpha.headers!['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    );
    const [after] = await stepsOf(
      participations.find((p) => p.team.name === 'Alpha')!.id,
    );
    expect(after).toMatchObject({
      status: 'SENT',
      delivery: { status: 'SENT', sentManually: false },
    });
    expect((await admin.get('/deliveries/quota')).body.data).toMatchObject({
      used: 4,
    });
  });

  it('flags emails already past their send time when a team signs up late (send now or skip)', async () => {
    const { participations } = await tournamentWithTeams(
      5,
      [plan(-10), plan(2)],
      undefined,
      [teamIds[0]],
    );
    const [past, future] = await stepsOf(participations[0].id);
    expect(past).toMatchObject({ name: 'T-10', isPastDue: true });
    expect(future.isPastDue).toBe(false);
    await ctx.scheduler.tick();
    expect(ctx.mail.sent).toHaveLength(0);
    await admin.post(`/steps/${future.id}/skip`).expect(409);
    await admin.post(`/steps/${past.id}/skip`).expect(200);
    expect((await steps().findOneByOrFail({ id: past.id })).status).toBe(
      'CANCELLED',
    );
  });

  it('does not catch up an email that is more than an hour late, but send-now works', async () => {
    const { participations } = await tournamentWithTeams(
      10,
      [plan(-1)],
      undefined,
      [teamIds[0]],
    );
    const [step] = await stepsOf(participations[0].id);
    await ctx.scheduler.tick(
      new Date(new Date(step.resolvedSendAt).getTime() + 2 * HOUR),
    );
    expect(ctx.mail.sent).toHaveLength(0);
    expect((await stepsOf(participations[0].id))[0].isPastDue).toBe(true);
    await admin.post(`/steps/${step.id}/send-now`).expect(200);
    await ctx.scheduler.tick();
    expect(ctx.mail.sent).toHaveLength(1);
    const [delivery] = (await admin.get(`/steps/${step.id}/deliveries`)).body
      .data;
    expect(delivery.triggeredBy).toMatchObject({ firstName: 'Ada' });
  });

  it('does not send to withdrawn teams', async () => {
    const { participations } = await tournamentWithTeams(
      10,
      [plan(-1)],
      undefined,
      [teamIds[0]],
    );
    const p = participations[0] as unknown as { id: string; version: number };
    await admin
      .post(`/participations/${p.id}/transition`, {
        to: 'WITHDRAWN',
        version: p.version,
      })
      .expect(200);
    const [step] = await stepsOf(p.id);
    await admin.post(`/steps/${step.id}/send-now`).expect(409);
    await ctx.scheduler.tick(
      new Date(new Date(step.resolvedSendAt).getTime() + 1000),
    );
    expect(ctx.mail.sent).toHaveLength(0);
  });

  it('skips unsubscribed teams and supports the unsubscribe flow', async () => {
    const team = await ctx.dataSource
      .getRepository(Team)
      .findOneByOrFail({ id: teamIds[1] });
    const anon = ctx.app.getHttpServer();
    await request(anon)
      .post(`/api/v1/public/unsubscribe/${team.unsubscribeToken}`)
      .type('form')
      .send('List-Unsubscribe=One-Click')
      .expect(200);
    const sent = await sendStepNow(admin, ctx.scheduler, {
      teamIds,
      variables: { venue: 'x' },
    });
    const statuses = await deliveries().find({
      where: { step: { id: In(sent.steps.map((s) => s.id)) } },
      relations: { team: true },
    });
    expect(statuses.find((d) => d.team?.name === 'Beta')).toMatchObject({
      status: 'SKIPPED',
      skipReason: 'unsubscribed',
    });
    expect(
      extractLink(ctx.mail.lastTo('alpha@t.test')!.html, '/unsubscribe'),
    ).toHaveLength(43);
    await admin.post(`/teams/${team.id}/resubscribe`).expect(201);
  });

  it('marks permanent failures FAILED and resends via the bulk endpoint', async () => {
    ctx.mail.failNext({
      responseCode: 550,
      response: '550 5.1.1 mailbox unavailable',
    });
    const sent = await sendStepNow(admin, ctx.scheduler, {
      teamIds: [teamIds[0]],
    });
    const [failed] = (
      await admin.get(
        `/deliveries?filter[status]=FAILED&filter[tournament]=${sent.tournamentId}`,
      )
    ).body.data;
    expect(failed.lastError).toContain('mailbox unavailable');
    ctx.mail.reset();
    await admin
      .post('/deliveries/bulk', { ids: [failed.id], action: 'resend' })
      .expect(200);
    await ctx.scheduler.tick();
    expect(ctx.mail.sent).toHaveLength(1);
    expect(
      (await steps().findOneByOrFail({ id: sent.steps[0].id })).status,
    ).toBe('SENT');
    await admin.post(`/deliveries/${failed.id}/resend`).expect(409);
  });

  it('retries transient errors with backoff', async () => {
    ctx.mail.failNext({ code: 'ECONNECTION', message: 'Connection timeout' });
    const sent = await sendStepNow(admin, ctx.scheduler, {
      teamIds: [teamIds[0]],
    });
    const queued = await deliveries().findOneByOrFail({
      step: { id: sent.steps[0].id },
    });
    expect(queued).toMatchObject({
      status: DeliveryStatus.QUEUED,
      attempts: 1,
    });
    await ctx.scheduler.tick(new Date(Date.now() + 2 * 60_000));
    expect(ctx.mail.sent).toHaveLength(1);
  });

  it('pauses all sending on a Gmail quota error without losing the attempt', async () => {
    ctx.mail.failNext({
      responseCode: 550,
      response: '550 5.4.5 Daily user sending limit exceeded.',
    });
    const sent = await sendStepNow(admin, ctx.scheduler, {
      teamIds: [teamIds[0]],
    });
    const quota = (await admin.get('/deliveries/quota')).body.data;
    expect(quota.pauseReason).toContain('daily sending limit');
    const delivery = await deliveries().findOneByOrFail({
      step: { id: sent.steps[0].id },
    });
    expect(delivery).toMatchObject({
      status: DeliveryStatus.QUEUED,
      attempts: 0,
    });
  });

  it('respects the rolling daily recipient cap and the per-minute rate', async () => {
    await ctx.dataSource
      .getRepository(Setting)
      .update({ id: 1 }, { dailyRecipientCap: 2 });
    await sendStepNow(admin, ctx.scheduler, { teamIds });
    // Queue order is FIFO; stop at the first email that does not fit (Alpha has a CC = 2 recipients).
    const recipients = ctx.mail.sent.reduce(
      (sum, m) => sum + 1 + (m.cc?.length ?? 0),
      0,
    );
    expect(recipients).toBeLessThanOrEqual(2);
    expect(ctx.mail.sent.length).toBeLessThan(3);

    await ctx.dataSource.query(
      `UPDATE email_deliveries SET status = 'FAILED' WHERE status = 'QUEUED'`,
    );
    await ctx.dataSource
      .getRepository(Setting)
      .update({ id: 1 }, { dailyRecipientCap: 1000, ratePerMinute: 1 });
    await ctx.dataSource.query(
      `UPDATE email_deliveries SET sent_at = now() - interval '2 days' WHERE sent_at IS NOT NULL`,
    );
    ctx.mail.reset();
    await sendStepNow(admin, ctx.scheduler, { teamIds });
    expect(ctx.mail.sent).toHaveLength(1);
  });

  it('manages the email lifecycle: pause, resume, edit with optimistic locking, cancel, delete, bulk', async () => {
    const { participations } = await tournamentWithTeams(
      20,
      [plan(-1)],
      undefined,
      [teamIds[0], teamIds[1]],
    );
    const [step] = await stepsOf(participations[0].id);
    const paused = (await admin.post(`/steps/${step.id}/pause`).expect(200))
      .body.data;
    expect(paused.status).toBe('PAUSED');
    await admin.post(`/steps/${step.id}/pause`).expect(409);
    const resumed = (await admin.post(`/steps/${step.id}/resume`).expect(200))
      .body.data;
    const edited = await admin
      .patch(`/steps/${step.id}`, { version: resumed.version, offsetDays: -3 })
      .expect(200);
    expect(edited.body.data.version).toBe(resumed.version + 1);
    await admin
      .patch(`/steps/${step.id}`, { version: resumed.version, name: 'x' })
      .expect(409);
    await admin.delete(`/steps/${step.id}`).expect(409);
    await admin.post(`/steps/${step.id}/cancel`).expect(200);
    await admin.delete(`/steps/${step.id}`).expect(200);
    await admin.post(`/steps/${step.id}/unknown`).expect(404);

    const [other] = await stepsOf(participations[1].id);
    const bulk = await admin
      .post('/steps/bulk', { ids: [other.id, step.id], action: 'pause' })
      .expect(200);
    expect(bulk.body.data.results.map((r: { ok: boolean }) => r.ok)).toEqual([
      true,
      false,
    ]);
  });

  it('lets a single team get an extra email', async () => {
    const { participations } = await tournamentWithTeams(20, [], undefined, [
      teamIds[2],
    ]);
    const created = await admin
      .post(`/participations/${participations[0].id}/steps`, {
        name: 'Directions',
        templateId,
        timingType: 'ABSOLUTE',
        sendAt: new Date(Date.now() + DAY).toISOString(),
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      name: 'Directions',
      planItemId: null,
      status: 'SCHEDULED',
    });
    const p = (await admin.get(`/participations/${participations[0].id}`)).body
      .data;
    expect(p.emails).toMatchObject({ total: 1, scheduled: 1, sent: 0 });
  });

  it('has no campaigns API anymore', async () => {
    await admin.get('/campaigns').expect(404);
    await admin.get('/announcements').expect(404);
  });
});
