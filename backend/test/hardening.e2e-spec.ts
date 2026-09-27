import { EmailStep, StepStatus } from '../src/modules/email/email-step.entity';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../src/modules/delivery/email-delivery.entity';
import { Setting } from '../src/modules/settings/setting.entity';
import { Client, createTestApp, TestContext } from './helpers';

const DAY = 86_400_000;

/** Regression tests for findings from the code review. */
describe('Hardening (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  let templateId: string;
  let teamId: string;

  const steps = () => ctx.dataSource.getRepository(EmailStep);
  const deliveries = () => ctx.dataSource.getRepository(EmailDelivery);

  /** A tournament (venue variable set) with one participation and its planned email. */
  async function participationWithStep(offsetDays = -1, startInDays = 10) {
    const start = new Date(Date.now() + startInDays * DAY)
      .toISOString()
      .slice(0, 10);
    const tournament = (
      await admin
        .post('/tournaments', {
          name: `Cup ${Date.now()}`,
          startDate: start,
          endDate: start,
          variables: { venue: 'Hall' },
          emailPlan: [
            {
              name: 'S',
              templateId,
              timingType: 'RELATIVE',
              offsetDays,
              timeOfDay: '09:00',
            },
          ],
        })
        .expect(201)
    ).body.data;
    const participation = (
      await admin
        .post('/participations', { tournamentId: tournament.id, teamId })
        .expect(201)
    ).body.data;
    const [step] = (
      await admin.get(`/participations/${participation.id}/steps`).expect(200)
    ).body.data;
    return { tournament, participation, step };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    teamId = (
      await admin.post('/teams', {
        name: 'T1',
        contactName: 'C',
        email: 't1@t.test',
      })
    ).body.data.id;
    templateId = (
      await admin.post('/templates', {
        name: 'Tpl',
        subject: 'At {{tournament.vars.venue}}',
        bodyHtml: '<p>Hi</p>',
      })
    ).body.data.id;
  });

  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    ctx.mail.reset();
    await ctx.dataSource
      .getRepository(Setting)
      .update({ id: 1 }, { pausedUntil: null, pauseReason: null });
  });

  it('H1: a step action cannot overwrite a status the scheduler changed meanwhile', async () => {
    const { step } = await participationWithStep();
    // The scheduler picked the step up after the client loaded it.
    await steps().update(step.id, { status: StepStatus.SENDING });
    await admin.post(`/steps/${step.id}/cancel`).expect(409);
    await admin
      .patch(`/steps/${step.id}`, { version: step.version, name: 'x' })
      .expect(409);
    expect((await steps().findOneByOrFail({ id: step.id })).status).toBe(
      StepStatus.SENDING,
    );
  });

  it('H2: an ambiguous SMTP failure is not retried (no duplicates)', async () => {
    const { step } = await participationWithStep();
    ctx.mail.failNext({
      code: 'ETIMEDOUT',
      command: 'DATA',
      message: 'Timeout',
    });
    await admin.post(`/steps/${step.id}/send-now`).expect(200);
    await ctx.scheduler.tick();
    const [delivery] = await deliveries().findBy({ step: { id: step.id } });
    expect(delivery.status).toBe(DeliveryStatus.FAILED);
    expect(delivery.lastError).toContain('Sent folder');
  });

  it('H4 (v2): missing variables never block saving', async () => {
    const { tournament, participation } = await participationWithStep();
    const noVarTemplate = (
      await admin.post('/templates', {
        name: 'Tpl2',
        subject: '{{tournament.vars.time}}',
        bodyHtml: '<p>x</p>',
      })
    ).body.data.id;
    const created = await admin
      .post(`/participations/${participation.id}/steps`, {
        name: 'S2',
        templateId: noVarTemplate,
        timingType: 'RELATIVE',
        offsetDays: -2,
        timeOfDay: '09:00',
      })
      .expect(201);
    expect(created.body.data.missingVariables).toEqual(['time']);
    await admin
      .patch(`/tournaments/${tournament.id}`, { variables: {} })
      .expect(200);
    await admin
      .patch(`/templates/${templateId}`, {
        subject: '{{tournament.vars.other}}',
      })
      .expect(200);
    await admin
      .patch(`/templates/${templateId}`, {
        subject: 'At {{tournament.vars.venue}}',
      })
      .expect(200);
  });

  it('M1: resending twice requeues a failed delivery only once', async () => {
    const { step } = await participationWithStep();
    ctx.mail.failNext({ responseCode: 550, response: '550 nope' });
    await admin.post(`/steps/${step.id}/send-now`).expect(200);
    await ctx.scheduler.tick();
    const [failed] = await deliveries().findBy({ step: { id: step.id } });
    await admin.post(`/deliveries/${failed.id}/resend`).expect(200);
    await ctx.scheduler.tick();
    await admin
      .post('/deliveries/bulk', { ids: [failed.id], action: 'resend' })
      .expect(200);
    const again = await admin.post(`/deliveries/${failed.id}/resend`);
    expect(again.status).toBe(409);
    await ctx.scheduler.tick();
    expect(ctx.mail.sent).toHaveLength(1);
  });

  it('M2: accepts request bodies larger than 100 kB', async () => {
    const bodyHtml = `<p>${'x'.repeat(150_000)}</p>`;
    await admin
      .post('/templates', { name: 'Big', subject: 'Big', bodyHtml })
      .expect(201);
  });

  it('M3: deliveries still queued a day after they were due are failed, not sent late', async () => {
    const { step } = await participationWithStep();
    await ctx.dataSource
      .getRepository(Setting)
      .update({ id: 1 }, { pausedUntil: new Date(Date.now() + DAY) });
    await admin.post(`/steps/${step.id}/send-now`).expect(200);
    await ctx.scheduler.tick();
    await deliveries().update(
      { step: { id: step.id } },
      { queuedAt: new Date(Date.now() - 2 * DAY) },
    );
    await ctx.dataSource
      .getRepository(Setting)
      .update({ id: 1 }, { pausedUntil: null });
    await ctx.scheduler.tick();
    expect(ctx.mail.sent).toHaveLength(0);
    const [d] = await deliveries().findBy({ step: { id: step.id } });
    expect(d.status).toBe(DeliveryStatus.FAILED);
    expect(d.lastError).toContain('24 hours');
  });

  it('L1: sending can be resumed manually after a pause', async () => {
    await ctx.dataSource
      .getRepository(Setting)
      .update(
        { id: 1 },
        { pausedUntil: new Date(Date.now() + DAY), pauseReason: 'x' },
      );
    await admin.patch('/settings', { organizerName: 'Org' }).expect(200);
    expect(
      (await admin.get('/deliveries/quota')).body.data.pausedUntil,
    ).not.toBeNull();
    await admin.post('/deliveries/resume').expect(200);
    expect(
      (await admin.get('/deliveries/quota')).body.data.pausedUntil,
    ).toBeNull();
  });

  it('L2: explicit null for required fields is a validation error, not a 500', async () => {
    await admin.patch('/settings', { ratePerMinute: null }).expect(400);
    await admin.patch(`/teams/${teamId}`, { name: null }).expect(400);
    await admin
      .patch(`/templates/${templateId}`, { subject: null })
      .expect(400);
  });

  it('L4: CSV export neutralizes formula cells', async () => {
    await admin
      .post('/teams', {
        name: '=HYPERLINK("x")',
        contactName: '+1',
        email: 'f@t.test',
      })
      .expect(201);
    const res = await admin.get('/teams/export').expect(200);
    expect(res.text).toContain(`"'=HYPERLINK(""x"")",'+1,f@t.test`);
  });
});
