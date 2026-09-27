import { DateTime } from 'luxon';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../src/modules/delivery/email-delivery.entity';
import { EmailStep } from '../src/modules/email/email-step.entity';
import { Setting } from '../src/modules/settings/setting.entity';
import { Client, createTestApp, TestContext } from './helpers';

const zone = 'Europe/Berlin';
const day = (offset: number) =>
  DateTime.now().setZone(zone).plus({ days: offset }).toISODate()!;

type Item = {
  id: string;
  type: string;
  severity: string;
  count: number | null;
  tournament: { id: string } | null;
  details: Record<string, unknown>;
};

describe('Tournament variables & work queue (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  let venueTemplate: string;
  const teamIds: string[] = [];

  const steps = () => ctx.dataSource.getRepository(EmailStep);
  const deliveries = () => ctx.dataSource.getRepository(EmailDelivery);
  const attention = async () =>
    (await admin.get('/attention').expect(200)).body.data as {
      items: Item[];
      counts: Record<string, number>;
    };
  const itemsOf = async (type: string) =>
    (await attention()).items.filter((i) => i.type === type);
  const stepsOf = async (participationId: string) =>
    (await admin.get(`/participations/${participationId}/steps`)).body.data;

  async function setup(
    variables: Record<string, string>,
    startInDays = 10,
    offsetDays = -1,
    teams = [teamIds[0]],
  ) {
    const t = (
      await admin
        .post('/tournaments', {
          name: `Cup ${Date.now()}`,
          startDate: day(startInDays),
          endDate: day(startInDays),
          variables,
          emailPlan: [
            {
              name: 'Logistics',
              templateId: venueTemplate,
              timingType: 'RELATIVE',
              offsetDays,
              timeOfDay: '09:00',
            },
          ],
        })
        .expect(201)
    ).body.data;
    const created = (
      await admin
        .post('/participations/bulk', { tournamentId: t.id, teamIds: teams })
        .expect(201)
    ).body.data.created;
    return {
      tournament: t,
      participations: created as { id: string; version: number }[],
    };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    for (const name of ['One', 'Two']) {
      teamIds.push(
        (
          await admin.post('/teams', {
            name,
            contactName: 'C',
            email: `${name}@t.test`,
          })
        ).body.data.id,
      );
    }
    venueTemplate = (
      await admin.post('/templates', {
        name: 'Venue',
        subject: 'See you at {{tournament.vars.venue}}',
        bodyHtml:
          '<p>Kick-off {{tournament.vars.kickoff}} ({{participation.ageGroup}})</p>',
      })
    ).body.data.id;
  });

  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    ctx.mail.reset();
    await admin.patch('/settings', { sendingMode: 'AUTOMATIC' }).expect(200);
    await ctx.dataSource.query(
      `UPDATE communication_steps SET status = 'CANCELLED', requires_decision = false WHERE status IN ('SCHEDULED','PAUSED')`,
    );
    await ctx.dataSource.query(
      `UPDATE email_deliveries SET status = 'SKIPPED' WHERE status IN ('QUEUED','READY','FAILED')`,
    );
    await ctx.dataSource.query(
      `UPDATE participations SET status = 'PARTICIPATED'`,
    );
    await ctx.dataSource
      .getRepository(Setting)
      .update(
        { id: 1 },
        { pausedUntil: null, pauseReason: null, ratePerMinute: 20 },
      );
    await ctx.dataSource.query(
      `UPDATE email_deliveries SET sent_at = now() - interval '2 days' WHERE sent_at IS NOT NULL`,
    );
  });

  describe('variables', () => {
    it('summarizes required and missing variables for the tournament and the participation', async () => {
      const { tournament, participations } = await setup({
        venue: 'Hall',
        old: 'x',
      });
      const t = (await admin.get(`/tournaments/${tournament.id}`)).body.data;
      expect(t.requiredVariables).toEqual([
        {
          key: 'kickoff',
          hasValue: false,
          missingFor: 1,
          usedBy: ['Logistics'],
        },
        { key: 'venue', hasValue: true, missingFor: 0, usedBy: ['Logistics'] },
      ]);
      expect(t.missingVariables).toEqual(['kickoff']);
      const p = (await admin.get(`/participations/${participations[0].id}`))
        .body.data;
      expect(p.missingVariables).toEqual(['kickoff']);
      expect(
        p.requiredVariables.find((v: { key: string }) => v.key === 'venue'),
      ).toMatchObject({ value: 'Hall', source: 'TOURNAMENT' });
      expect(p.emails).toMatchObject({ total: 1, blocked: 1 });
      const [step] = await stepsOf(p.id);
      expect(step.missingVariables).toEqual(['kickoff']);
      const filtered = await admin
        .get(
          `/participations?filter[tournament]=${tournament.id}&filter[missingVariables]=true`,
        )
        .expect(200);
      expect(filtered.body.meta.total).toBe(1);
    });

    it('lets a team override a tournament value; blank overrides fall back', async () => {
      const { participations } = await setup({
        venue: 'Hall',
        kickoff: '10:00',
      });
      const p = participations[0];
      const updated = (
        await admin
          .patch(`/participations/${p.id}`, {
            version: p.version,
            variables: { kickoff: '11:30', venue: '  ' },
          })
          .expect(200)
      ).body.data;
      expect(updated.requiredVariables).toEqual([
        expect.objectContaining({
          key: 'kickoff',
          value: '11:30',
          source: 'PARTICIPATION',
        }),
        expect.objectContaining({
          key: 'venue',
          value: 'Hall',
          source: 'TOURNAMENT',
        }),
      ]);
      await admin
        .patch(`/participations/${p.id}`, {
          version: updated.version,
          variables: { 'bad key': 'x' },
        })
        .expect(422);
    });

    it('blocks sending until the values are provided, then sends', async () => {
      const { tournament, participations } = await setup({ venue: 'Hall' });
      const [step] = await stepsOf(participations[0].id);
      const blocked = await admin
        .post(`/steps/${step.id}/send-now`)
        .expect(422);
      expect(blocked.body.error.details.missingVariables).toEqual(['kickoff']);
      const dueAt = new Date(new Date(step.resolvedSendAt).getTime() + 1000);
      await ctx.scheduler.tick(dueAt);
      expect(ctx.mail.sent).toHaveLength(0);
      expect(await deliveries().countBy({ step: { id: step.id } })).toBe(0);

      await admin
        .patch(`/tournaments/${tournament.id}`, {
          variables: { venue: 'Hall', kickoff: '10:00' },
        })
        .expect(200);
      await ctx.scheduler.tick(dueAt);
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].subject).toBe('See you at Hall');
    });

    it('holds queued deliveries and refuses to copy when a value is removed later', async () => {
      await admin.patch('/settings', { sendingMode: 'MANUAL' }).expect(200);
      const { tournament, participations } = await setup({
        venue: 'Hall',
        kickoff: '10:00',
      });
      const [step] = await stepsOf(participations[0].id);
      await admin.post(`/steps/${step.id}/send-now`).expect(200);
      await ctx.scheduler.tick();
      const ready = await deliveries().findOneByOrFail({
        step: { id: step.id },
      });
      expect(ready.status).toBe(DeliveryStatus.READY);
      await admin
        .patch(`/tournaments/${tournament.id}`, {
          variables: { venue: 'Hall' },
        })
        .expect(200);
      const msg = await admin
        .get(`/deliveries/${ready.id}/message`)
        .expect(422);
      expect(msg.body.error.details).toEqual({ missingVariables: ['kickoff'] });
      await admin.post(`/deliveries/${ready.id}/mark-sent`).expect(422);
    });

    it('reports missing variables in the template preview for a tournament or participation', async () => {
      const { tournament, participations } = await setup({ venue: 'Hall' });
      const body = {
        subject: '{{tournament.vars.venue}}',
        bodyHtml: '<p>{{tournament.vars.kickoff}} {{tournament.name}}</p>',
      };
      const byTournament = await admin
        .post('/templates/preview', { ...body, tournamentId: tournament.id })
        .expect(200);
      expect(byTournament.body.data.missingVariables).toEqual(['kickoff']);
      expect(byTournament.body.data.html).toContain(tournament.name);
      const byParticipation = await admin
        .post('/templates/preview', {
          ...body,
          participationId: participations[0].id,
        })
        .expect(200);
      expect(byParticipation.body.data.subject).toBe('Hall');
    });
  });

  describe('work queue', () => {
    it('aggregates missing variables per tournament, urgent when due soon', async () => {
      const { tournament } = await setup({}, 30, -1, teamIds);
      let item = (await itemsOf('MISSING_VARIABLES')).find(
        (i) => i.tournament?.id === tournament.id,
      )!;
      expect(item).toMatchObject({
        severity: 'MEDIUM',
        count: 2,
        details: { missingVariables: ['kickoff', 'venue'] },
      });
      const soon = (await setup({ venue: 'x' }, 1, 0)).tournament;
      item = (await itemsOf('MISSING_VARIABLES')).find(
        (i) => i.tournament?.id === soon.id,
      )!;
      expect(item.severity).toBe('HIGH');
    });

    it('aggregates past-due emails per tournament and step, and bulk send-now works', async () => {
      const { tournament } = await setup(
        { venue: 'a', kickoff: 'b' },
        5,
        -10,
        teamIds,
      );
      const [item] = (await itemsOf('PAST_DUE')).filter(
        (i) => i.tournament?.id === tournament.id,
      );
      expect(item).toMatchObject({
        severity: 'HIGH',
        count: 2,
        details: { stepName: 'Logistics', teams: ['One', 'Two'] },
      });
      const res = await admin
        .post('/steps/bulk', { ids: item.details.stepIds, action: 'send-now' })
        .expect(200);
      expect(res.body.data.results.every((r: { ok: boolean }) => r.ok)).toBe(
        true,
      );
      await ctx.scheduler.tick();
      expect(ctx.mail.sent).toHaveLength(2);
      expect(
        (await itemsOf('PAST_DUE')).filter(
          (i) => i.tournament?.id === tournament.id,
        ),
      ).toEqual([]);
    });

    it('lists emails ready to send and failed emails per tournament', async () => {
      await admin.patch('/settings', { sendingMode: 'MANUAL' }).expect(200);
      const { tournament, participations } = await setup(
        { venue: 'a', kickoff: 'b' },
        10,
        -1,
        teamIds,
      );
      for (const p of participations) {
        const [s] = await stepsOf(p.id);
        await admin.post(`/steps/${s.id}/send-now`).expect(200);
      }
      await ctx.scheduler.tick();
      const ready = (await itemsOf('READY_TO_SEND')).find(
        (i) => i.tournament?.id === tournament.id,
      )!;
      expect(ready).toMatchObject({ severity: 'HIGH', count: 2 });

      await ctx.dataSource.query(
        `UPDATE email_deliveries SET status = 'FAILED' WHERE status = 'READY'`,
      );
      const failed = (await itemsOf('FAILED_DELIVERIES')).find(
        (i) => i.tournament?.id === tournament.id,
      )!;
      expect(failed).toMatchObject({ severity: 'MEDIUM', count: 2 });
      await admin
        .post('/deliveries/bulk', {
          ids: failed.details.deliveryIds,
          action: 'dismiss',
        })
        .expect(200);
      expect(
        (await itemsOf('FAILED_DELIVERIES')).filter(
          (i) => i.tournament?.id === tournament.id,
        ),
      ).toEqual([]);
      const [one] = await stepsOf(participations[0].id);
      expect((await steps().findOneByOrFail({ id: one.id })).status).toBe(
        'SENT',
      );
    });

    it('lists paused sending and, in manual mode, emails due soon', async () => {
      await ctx.dataSource.getRepository(Setting).update(
        { id: 1 },
        {
          pausedUntil: new Date(Date.now() + 86_400_000),
          pauseReason: 'Gmail limit',
        },
      );
      const { tournament } = await setup(
        { venue: 'a', kickoff: 'b' },
        0,
        0,
        teamIds,
      );
      await ctx.dataSource.query(
        `UPDATE communication_steps SET resolved_send_at = now() + interval '5 hours', requires_decision = false
          WHERE participation_id IN (SELECT id FROM participations WHERE tournament_id = $1)`,
        [tournament.id],
      );
      expect((await attention()).items[0].type).toBe('SENDING_PAUSED');
      expect(
        (await itemsOf('DUE_SOON')).filter(
          (i) => i.tournament?.id === tournament.id,
        ),
      ).toEqual([]);
      await admin.patch('/settings', { sendingMode: 'MANUAL' }).expect(200);
      expect(
        (await itemsOf('DUE_SOON')).find(
          (i) => i.tournament?.id === tournament.id,
        ),
      ).toMatchObject({ severity: 'LOW', count: 2 });
      const { counts, items } = await attention();
      expect(counts.total).toBe(items.length);
      expect(items.every((i) => !('campaign' in i))).toBe(true);
    });
  });
});
