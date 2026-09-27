import { In } from 'typeorm';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../src/modules/delivery/email-delivery.entity';
import {
  Client,
  createTestApp,
  SentEmails,
  sendStepNow,
  stepOf,
  TestContext,
} from './helpers';

describe('Manual sending (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  const teamIds: string[] = [];

  const deliveries = () => ctx.dataSource.getRepository(EmailDelivery);
  const deliveriesOf = (sent: SentEmails) =>
    deliveries().find({
      where: { step: { id: In(sent.steps.map((s) => s.id)) } },
      order: { toEmail: 'ASC' },
    });

  const send = (teams: string[] = teamIds) =>
    sendStepNow(admin, ctx.scheduler, {
      teamIds: teams,
      subject: 'Rain update for {{team.name}}',
      bodyHtml:
        '<p>Hi <strong>{{team.contactName}}</strong>, pitch 2 is closed.</p>',
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    for (const [name, email, cc] of [
      ['Alpha', 'alpha@t.test', ['coach@alpha.test']],
      ['Beta', 'beta@t.test', []],
    ] as const) {
      teamIds.push(
        (
          await admin.post('/teams', {
            name,
            contactName: `${name} C`,
            email,
            ccEmails: cc,
          })
        ).body.data.id,
      );
    }
  });

  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    ctx.mail.reset();
    await admin.patch('/settings', { sendingMode: 'MANUAL' }).expect(200);
  });

  it('exposes the sending mode in settings', async () => {
    const res = await admin.get('/settings').expect(200);
    expect(res.body.data).toMatchObject({
      sendingMode: 'MANUAL',
      automaticSendingAvailable: true,
    });
    await admin.patch('/settings', { sendingMode: 'OTHER' }).expect(400);
  });

  it('prepares READY deliveries instead of sending when an email is due', async () => {
    const sent = await send();
    expect(ctx.mail.sent).toHaveLength(0);
    expect((await deliveriesOf(sent)).map((d) => d.status)).toEqual([
      'READY',
      'READY',
    ]);
    expect(await stepOf(admin, sent.steps[0])).toMatchObject({
      status: 'SENDING',
      delivery: { status: 'READY' },
    });
  });

  it('renders a copyable message with mailto link and unsubscribe footer', async () => {
    const sent = await send();
    const [alpha] = await deliveriesOf(sent);
    const msg = (await admin.get(`/deliveries/${alpha.id}/message`).expect(200))
      .body.data;
    expect(msg).toMatchObject({
      deliveryId: alpha.id,
      status: 'READY',
      to: 'alpha@t.test',
      cc: ['coach@alpha.test'],
      subject: 'Rain update for Alpha',
      mailtoTruncated: false,
    });
    expect(msg.html).toContain('<strong>Alpha C</strong>');
    expect(msg.html).toContain('/unsubscribe/');
    expect(msg.html).not.toContain('<!doctype html>');
    expect(msg.text).toContain('Hi Alpha C');
    const params = new URLSearchParams(msg.mailtoUrl.split('?')[1]);
    expect(msg.mailtoUrl).toMatch(/^mailto:alpha@t\.test\?/);
    expect(params.get('cc')).toBe('coach@alpha.test');
    expect(params.get('subject')).toBe('Rain update for Alpha');
    expect(params.get('body')).toContain('Hi Alpha C');
  });

  it('marks deliveries as sent, supports undo, and settles the step', async () => {
    const sent = await send([teamIds[0]]);
    const [a] = await deliveriesOf(sent);

    const marked = (
      await admin.post(`/deliveries/${a.id}/mark-sent`).expect(200)
    ).body.data;
    expect(marked).toMatchObject({
      status: 'SENT',
      sentManually: true,
      markedSentBy: { firstName: 'Ada' },
    });
    await admin.post(`/deliveries/${a.id}/mark-sent`).expect(409);
    expect(
      (await deliveries().findOneByOrFail({ id: a.id })).renderedSubject,
    ).toBe('Rain update for Alpha');
    expect((await stepOf(admin, sent.steps[0])).status).toBe('SENT');

    // Manual sends do not use the automatic quota
    expect((await admin.get('/deliveries/quota')).body.data.used).toBe(0);
    // Undo after the step settled reopens it
    await admin.post(`/deliveries/${a.id}/mark-unsent`).expect(200);
    expect(await stepOf(admin, sent.steps[0])).toMatchObject({
      status: 'SENDING',
      delivery: { status: 'READY' },
    });
  });

  it('lists ready deliveries across teams for the walk-through', async () => {
    const sent = await send();
    const res = await admin
      .get(
        `/deliveries?filter[status]=READY&filter[tournament]=${sent.tournamentId}&sort=team`,
      )
      .expect(200);
    expect(
      res.body.data.map((d: { team: { name: string } }) => d.team.name),
    ).toEqual(['Alpha', 'Beta']);
    expect(res.body.data[0]).toMatchObject({
      step: { name: 'Email' },
      tournament: { id: sent.tournamentId },
      participationId: sent.steps.find((s) => s.teamId === teamIds[0])!
        .participationId,
    });
    const facet = res.body.meta.facets.find(
      (f: { key: string }) => f.key === 'tournament',
    );
    expect(facet.options).toContainEqual(
      expect.objectContaining({ value: sent.tournamentId, count: 2 }),
    );
  });

  it('skips unsubscribed teams in manual mode too', async () => {
    await ctx.dataSource.query(
      `UPDATE teams SET unsubscribed_at = now() WHERE id = $1`,
      [teamIds[1]],
    );
    const sent = await send();
    expect((await deliveriesOf(sent)).map((d) => d.status).sort()).toEqual([
      'READY',
      'SKIPPED',
    ]);
    await ctx.dataSource.query(
      `UPDATE teams SET unsubscribed_at = NULL WHERE id = $1`,
      [teamIds[1]],
    );
  });

  it('lets a failed automatic delivery be sent manually', async () => {
    await admin.patch('/settings', { sendingMode: 'AUTOMATIC' }).expect(200);
    ctx.mail.failNext({ responseCode: 550, response: '550 rejected' });
    const [failed] = await deliveriesOf(await send([teamIds[1]]));
    expect(failed.status).toBe(DeliveryStatus.FAILED);
    await admin.get(`/deliveries/${failed.id}/message`).expect(200);
    await admin.post(`/deliveries/${failed.id}/mark-sent`).expect(200);
  });

  it('resending a failed delivery in manual mode makes it READY; bulk dismiss skips it', async () => {
    await admin.patch('/settings', { sendingMode: 'AUTOMATIC' }).expect(200);
    ctx.mail.failNext(
      { responseCode: 550, response: '550 rejected' },
      { responseCode: 550, response: '550 rejected' },
    );
    const sent = await send();
    await admin.patch('/settings', { sendingMode: 'MANUAL' }).expect(200);
    const [a, b] = await deliveriesOf(sent);
    const res = await admin
      .post('/deliveries/bulk', { ids: [a.id], action: 'resend' })
      .expect(200);
    expect(res.body.data.results).toEqual([{ id: a.id, ok: true }]);
    await ctx.scheduler.tick();
    expect((await deliveries().findOneByOrFail({ id: a.id })).status).toBe(
      DeliveryStatus.READY,
    );
    expect(ctx.mail.sent).toHaveLength(0);

    const dismissed = await admin
      .post('/deliveries/bulk', { ids: [b.id, a.id], action: 'dismiss' })
      .expect(200);
    expect(dismissed.body.data.results).toEqual([
      { id: b.id, ok: true },
      { id: a.id, ok: false, error: 'Only failed emails can be dismissed' },
    ]);
    expect(await deliveries().findOneByOrFail({ id: b.id })).toMatchObject({
      status: 'SKIPPED',
      skipReason: 'dismissed',
    });
  });

  it('switching to manual turns queued deliveries into READY', async () => {
    await admin
      .patch('/settings', { sendingMode: 'AUTOMATIC', ratePerMinute: 1 })
      .expect(200);
    const sent = await send();
    expect(ctx.mail.sent).toHaveLength(1);
    await admin
      .patch('/settings', { sendingMode: 'MANUAL', ratePerMinute: 20 })
      .expect(200);
    await ctx.scheduler.tick();
    expect((await deliveriesOf(sent)).map((d) => d.status).sort()).toEqual([
      DeliveryStatus.READY,
      DeliveryStatus.SENT,
    ]);
    expect(ctx.mail.sent).toHaveLength(1);
  });

  it('returns the invite link so invitations work without email', async () => {
    const res = await admin
      .post('/users/invitations', { email: 'new@example.com' })
      .expect(201);
    expect(res.body.data.inviteUrl).toMatch(
      /^http:\/\/app\.test\/invite\/[A-Za-z0-9_-]{43}$/,
    );
    expect(
      (await admin.get('/users/invitations')).body.data[0].inviteUrl,
    ).toBeUndefined();
  });

  it('deleting a team removes its participations and their emails', async () => {
    const temp = (
      await admin.post('/teams', {
        name: 'Temp',
        contactName: 'T',
        email: 'temp@t.test',
      })
    ).body.data;
    const sent = await send([temp.id]);
    const [before] = await deliveriesOf(sent);
    await admin.delete(`/teams/${temp.id}`).expect(200);
    expect(await deliveries().findOneBy({ id: before.id })).toBeNull();
    await admin
      .get(`/participations/${sent.steps[0].participationId}`)
      .expect(404);
  });
});
