import type { Client as ClientType, TestContext } from './helpers';

/** Server without any mailbox configured: everything works in manual mode. */
describe('No mailbox configured (e2e)', () => {
  let ctx: TestContext;
  let admin: ClientType;
  let helpers: typeof import('./helpers');

  beforeAll(async () => {
    process.env.MAIL_AUTH_MODE = 'NONE';
    delete process.env.MAIL_USER;
    delete process.env.SMTP_HOST;
    // Load the app only after the environment is changed (config is read on import).

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    helpers = require('./helpers') as typeof import('./helpers');
    const { Client, createTestApp } = helpers;
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
  });

  afterAll(() => ctx.app.close());

  it('reports manual mode and refuses automatic sending', async () => {
    const res = await admin.get('/settings').expect(200);
    expect(res.body.data).toMatchObject({
      sendingMode: 'MANUAL',
      automaticSendingAvailable: false,
      authMode: 'NONE',
      senderEmail: null,
    });
    await admin.patch('/settings', { sendingMode: 'AUTOMATIC' }).expect(422);
    await admin.post('/settings/test-email').expect(409);
    await admin
      .post('/templates/test-send', { subject: 'x', bodyHtml: '<p>x</p>' })
      .expect(409);
  });

  it('prepares campaign steps for manual sending', async () => {
    const team = (
      await admin.post('/teams', {
        name: 'T',
        contactName: 'C',
        email: 't@t.test',
      })
    ).body.data;
    const step = await helpers.sendStepNow(admin, ctx.scheduler, {
      teamIds: [team.id],
    });
    const [d] = (await admin.get(`/steps/${step.steps[0].id}/deliveries`)).body
      .data;
    expect(d.status).toBe('READY');
    expect(ctx.mail.sent).toHaveLength(0);
  });

  it('invites co-organizers via a copyable link', async () => {
    const res = await admin
      .post('/users/invitations', { email: 'co@example.com' })
      .expect(201);
    expect(res.body.data.inviteUrl).toContain('/invite/');
    expect(ctx.mail.sent).toHaveLength(0);
  });

  it('password reset requests succeed without revealing that no email is sent', async () => {
    await admin
      .post('/auth/password-reset/request', { email: 'admin@example.com' })
      .expect(200);
    expect(ctx.mail.sent).toHaveLength(0);
  });
});
