import request from 'supertest';
import { Invitation } from '../src/modules/user/invitation.entity';
import {
  ADMIN,
  Client,
  createTestApp,
  extractLink,
  TestContext,
} from './helpers';

describe('Auth, users & invitations (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
  });

  afterAll(() => ctx.app.close());
  beforeEach(() => ctx.mail.reset());

  it('creates the initial admin from env and returns it from /auth/me', async () => {
    const res = await admin.get('/auth/me').expect(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { email: ADMIN.email, firstName: 'Ada' },
      error: null,
    });
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('rejects wrong credentials with the error envelope', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN.email, password: 'wrong-password-123' })
      .expect(401);
    expect(res.body).toEqual({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
    });
  });

  it('requires a session for protected routes', async () => {
    await request(ctx.app.getHttpServer()).get('/api/v1/teams').expect(401);
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await admin.agent
      .post('/api/v1/groups')
      .send({ name: 'No CSRF' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('validates request bodies', async () => {
    const res = await admin
      .post('/groups', { name: '', unknown: 1 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.stringContaining('unknown')]),
    );
  });

  it('invalidates the session on logout', async () => {
    const client = await Client.login(ctx.app);
    await client.post('/auth/logout').expect(200);
    await client.get('/auth/me').expect(401);
  });

  describe('invitations', () => {
    it('invites, validates and accepts a co-organizer', async () => {
      const inv = await admin
        .post('/users/invitations', { email: 'Co@Example.com' })
        .expect(201);
      expect(inv.body.data).toMatchObject({
        email: 'co@example.com',
        invitedBy: { firstName: 'Ada' },
      });

      const mail = ctx.mail.lastTo('co@example.com')!;
      const token = extractLink(mail.html, '/invite');
      const check = await request(ctx.app.getHttpServer())
        .get(`/api/v1/invitations/${token}`)
        .expect(200);
      expect(check.body.data.email).toBe('co@example.com');

      const accept = request.agent(ctx.app.getHttpServer());
      await accept
        .post('/api/v1/invitations/accept')
        .send({
          token,
          firstName: 'Cora',
          lastName: 'Org',
          password: 'cora-password-123',
        })
        .expect(200);
      await accept.get('/api/v1/auth/me').expect(200);

      // Single use
      await request(ctx.app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .send({
          token,
          firstName: 'X',
          lastName: 'Y',
          password: 'another-password-1',
        })
        .expect(409);
      const pending = await admin.get('/users/invitations').expect(200);
      expect(pending.body.data).toHaveLength(0);
    });

    it('rejects expired invitations and allows resending', async () => {
      const inv = await admin
        .post('/users/invitations', { email: 'late@example.com' })
        .expect(201);
      const token = extractLink(
        ctx.mail.lastTo('late@example.com')!.html,
        '/invite',
      );
      await ctx.dataSource
        .getRepository(Invitation)
        .update(inv.body.data.id, { expiresAt: new Date(Date.now() - 1000) });
      await request(ctx.app.getHttpServer())
        .get(`/api/v1/invitations/${token}`)
        .expect(409);

      const resent = await admin
        .post(`/users/invitations/${inv.body.data.id}/resend`)
        .expect(201);
      const newToken = extractLink(
        ctx.mail.lastTo('late@example.com')!.html,
        '/invite',
      );
      expect(newToken).not.toBe(token);
      await request(ctx.app.getHttpServer())
        .get(`/api/v1/invitations/${newToken}`)
        .expect(200);

      await admin
        .delete(`/users/invitations/${resent.body.data.id}`)
        .expect(200);
      await request(ctx.app.getHttpServer())
        .get(`/api/v1/invitations/${newToken}`)
        .expect(404);
    });

    it('does not invite existing users', async () => {
      await admin
        .post('/users/invitations', { email: ADMIN.email })
        .expect(409);
    });
  });

  describe('user management', () => {
    it('prevents deactivating yourself', async () => {
      const me = await admin.get('/auth/me');
      await admin
        .patch(`/users/${me.body.data.id}`, { isActive: false })
        .expect(409);
    });

    it('deactivating a user ends their session immediately', async () => {
      const cora = await Client.login(ctx.app, {
        email: 'co@example.com',
        password: 'cora-password-123',
      });
      const users = await admin.get('/users').expect(200);
      const coraId = users.body.data.find(
        (u: { email: string }) => u.email === 'co@example.com',
      ).id;

      await admin.patch(`/users/${coraId}`, { isActive: false }).expect(200);
      await cora.get('/auth/me').expect(401);
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'co@example.com', password: 'cora-password-123' })
        .expect(401);

      await admin.patch(`/users/${coraId}`, { isActive: true }).expect(200);
    });
  });

  describe('password reset', () => {
    it('resets the password with the emailed token and invalidates old sessions', async () => {
      const oldSession = await Client.login(ctx.app, {
        email: 'co@example.com',
        password: 'cora-password-123',
      });
      const anon = request(ctx.app.getHttpServer());
      await anon
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'co@example.com' })
        .expect(200);
      const token = extractLink(
        ctx.mail.lastTo('co@example.com')!.html,
        '/reset-password',
      );

      await anon
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token, password: 'brand-new-password-1' })
        .expect(200);
      await oldSession.get('/auth/me').expect(401);
      await Client.login(ctx.app, {
        email: 'co@example.com',
        password: 'brand-new-password-1',
      });
      await anon
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token, password: 'again-password-12' })
        .expect(409);
    });

    it('does not reveal unknown emails', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'nobody@example.com' })
        .expect(200);
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });

  it('reports health', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(res.body.data).toEqual({ status: 'ok', db: 'ok' });
  });

  it('manages settings and sends a test email', async () => {
    const res = await admin
      .patch('/settings', {
        organizerName: 'Summer League',
        senderName: 'League "Team"',
        footerHtml: '<p onclick="x">Hi</p>',
      })
      .expect(200);
    expect(res.body.data).toMatchObject({
      organizerName: 'Summer League',
      senderEmail: 'organizer@example.com',
      footerHtml: '<p>Hi</p>',
      authMode: 'SMTP',
      dailyRecipientCap: 1000,
    });
    await admin.patch('/settings', { dailyRecipientCap: 5000 }).expect(400);
    await admin.post('/settings/test-email').expect(201);
    expect(ctx.mail.lastTo(ADMIN.email)?.from).toBe(
      '"League Team" <organizer@example.com>',
    );
  });
});
