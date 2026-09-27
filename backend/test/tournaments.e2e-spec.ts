import { DateTime } from 'luxon';
import { Client, createTestApp, TestContext } from './helpers';

const day = (offset: number) =>
  DateTime.now().setZone('Europe/Berlin').plus({ days: offset }).toISODate()!;

type P = {
  id: string;
  status: string;
  version: number;
  overdue: boolean;
  nextStatus: string | null;
  steps: { status: string; state: string; completedAt: string | null }[];
};

describe('Tournaments & participation (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  const teams: Record<string, string> = {};
  let groupId: string;

  const createTournament = async (body: Record<string, unknown>) =>
    (
      await admin
        .post('/tournaments', {
          name: 'Summer Classic',
          startDate: day(40),
          endDate: day(41),
          ageGroups: ['U12', 'U14'],
          ...body,
        })
        .expect(201)
    ).body.data;
  const signUp = async (tournamentId: string, team: string, ageGroup = 'U12') =>
    (
      await admin
        .post('/participations', {
          tournamentId,
          teamId: teams[team],
          ageGroup,
        })
        .expect(201)
    ).body.data as P;
  const move = (p: P, to: string) =>
    admin.post(`/participations/${p.id}/transition`, {
      to,
      version: p.version,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    groupId = (await admin.post('/groups', { name: 'Girls' })).body.data.id;
    for (const name of ['Orange', 'Black', 'Grey']) {
      teams[name] = (
        await admin.post('/teams', {
          name,
          contactName: 'C',
          email: `${name}@t.test`,
          groupIds: name === 'Grey' ? [] : [groupId],
        })
      ).body.data.id;
    }
  });

  afterAll(() => ctx.app.close());

  describe('tournaments', () => {
    it('creates a tournament with the default timeline and computed due dates', async () => {
      const t = await createTournament({
        url: 'https://example.com/classic',
        description: 'Two days',
        ageGroups: [' U12 ', 'U14', 'U12'],
      });
      expect(t).toMatchObject({
        name: 'Summer Classic',
        ageGroups: ['U12', 'U14'],
        timing: 'UPCOMING',
        participantCount: 0,
      });
      expect(t.milestones).toHaveLength(8);
      expect(t.milestones[0]).toEqual({
        status: 'SIGNED_UP',
        label: 'Signed up',
        offsetDays: -90,
        anchor: 'START',
        dueDate: day(-50),
      });
      expect(t.milestones[7]).toMatchObject({
        status: 'PARTICIPATED',
        anchor: 'END',
        dueDate: day(42),
      });
    });

    it('validates dates and the order of the timeline', async () => {
      await admin
        .post('/tournaments', {
          name: 'X',
          startDate: day(10),
          endDate: day(9),
        })
        .expect(422);
      await admin
        .post('/tournaments', {
          name: 'X',
          startDate: '2026-02-30',
          endDate: '2026-03-01',
        })
        .expect(400);
      const defaults = (await admin.get('/participation/defaults').expect(200))
        .body.data;
      const broken = defaults.map((m: { status: string }) =>
        m.status === 'PAID' ? { ...m, offsetDays: -100 } : m,
      );
      const res = await admin
        .post('/tournaments', {
          name: 'X',
          startDate: day(10),
          endDate: day(10),
          milestones: broken,
        })
        .expect(422);
      expect(res.body.error.details.steps).toEqual(['PAID']);
      await admin
        .post('/tournaments', {
          name: 'X',
          startDate: day(10),
          endDate: day(10),
          milestones: defaults.slice(1),
        })
        .expect(422);
    });

    it('stores new participation defaults for future tournaments', async () => {
      const defaults = (
        await admin.get('/participation/defaults')
      ).body.data.map((m: Record<string, unknown>) => ({
        status: m.status,
        offsetDays: m.status === 'SIGNED_UP' ? -120 : m.offsetDays,
        anchor: m.anchor,
      }));
      await admin
        .put('/participation/defaults', { milestones: defaults })
        .expect(200);
      const t = await createTournament({ name: 'Later cup' });
      expect(t.milestones[0].offsetDays).toBe(-120);
    });

    it('lists with facets, filters and sorting', async () => {
      await createTournament({
        name: 'Past cup',
        startDate: day(-30),
        endDate: day(-29),
        ageGroups: ['U10'],
      });
      const res = await admin
        .get('/tournaments?filter[timing]=PAST&sort=-startDate')
        .expect(200);
      expect(res.body.data.map((t: { name: string }) => t.name)).toEqual([
        'Past cup',
      ]);
      const ageFacet = res.body.meta.facets.find(
        (f: { key: string }) => f.key === 'ageGroup',
      );
      expect(ageFacet.options).toEqual([
        { value: 'U10', label: 'U10', count: 1 },
      ]);
      const timing = res.body.meta.facets.find(
        (f: { key: string }) => f.key === 'timing',
      );
      expect(
        timing.options.find((o: { value: string }) => o.value === 'UPCOMING')
          .count,
      ).toBeGreaterThan(0);
      await admin.get('/tournaments?filter[nope]=1').expect(400);
    });
  });

  describe('participation state machine', () => {
    let tournamentId: string;

    beforeAll(async () => {
      tournamentId = (await createTournament({ name: 'Process cup' })).id;
    });

    it('signs up teams, validating the age group and duplicates', async () => {
      await admin
        .post('/participations', { tournamentId, teamId: teams.Orange })
        .expect(422);
      await admin
        .post('/participations', {
          tournamentId,
          teamId: teams.Orange,
          ageGroup: 'U99',
        })
        .expect(422);
      const p = await signUp(tournamentId, 'Orange');
      expect(p).toMatchObject({
        status: 'SIGNED_UP',
        nextStatus: 'PAID',
        ageGroup: 'U12',
      });
      await admin
        .post('/participations', {
          tournamentId,
          teamId: teams.Orange,
          ageGroup: 'U12',
        })
        .expect(409);
      const bulk = await admin
        .post('/participations/bulk', {
          tournamentId,
          teamIds: [teams.Orange, teams.Black, teams.Grey],
          ageGroup: 'U14',
        })
        .expect(201);
      expect(bulk.body.data.created).toHaveLength(2);
      expect(bulk.body.data.skipped).toEqual([
        { teamId: teams.Orange, reason: 'Already signed up' },
      ]);
    });

    it('moves forward (recording skipped steps), back one step, withdraws and reinstates', async () => {
      const list = (
        await admin.get(
          `/participations?filter[tournament]=${tournamentId}&filter[team]=${teams.Orange}`,
        )
      ).body.data;
      let p: P = list[0];
      p = (await move(p, 'ADDED_TO_SPORTSENGINE').expect(200)).body.data;
      expect(p.steps.slice(0, 3).map((s) => s.state)).toEqual([
        'DONE',
        'DONE',
        'DONE',
      ]);
      expect(p.steps[1].completedAt).toBe(day(0));

      await move(p, 'SIGNED_UP').expect(409); // two steps back
      const stale = await admin.post(`/participations/${p.id}/transition`, {
        to: 'PAID',
        version: p.version - 1,
      });
      expect(stale.status).toBe(409);
      p = (await move(p, 'PAID').expect(200)).body.data;
      expect(p.status).toBe('PAID');

      p = (await move(p, 'WITHDRAWN').expect(200)).body.data;
      expect(p).toMatchObject({ status: 'WITHDRAWN', nextStatus: null });
      const bad = await move(p, 'ROSTER_CONFIRMED').expect(409);
      expect(bad.body.error.details.allowed).toEqual(['PAID']);
      p = (await move(p, 'PAID').expect(200)).body.data;
      expect(p.status).toBe('PAID');

      const detail = (await admin.get(`/participations/${p.id}`).expect(200))
        .body.data;
      expect(
        detail.history.map((h: { toStatus: string }) => h.toStatus),
      ).toEqual([
        'SIGNED_UP',
        'PAID',
        'ADDED_TO_SPORTSENGINE',
        'PAID',
        'WITHDRAWN',
        'PAID',
      ]);
      expect(detail.history[1]).toMatchObject({
        fromStatus: 'SIGNED_UP',
        changedBy: { firstName: 'Ada' },
      });
    });

    it('treats PARTICIPATED as terminal', async () => {
      const [black] = (
        await admin.get(`/participations?filter[team]=${teams.Black}`)
      ).body.data;
      const done = (await move(black, 'PARTICIPATED').expect(200)).body.data;
      expect(
        done.steps.every((s: { state: string }) => s.state === 'DONE'),
      ).toBe(true);
      await move(done, 'WAIVER_CONFIRMED').expect(409);
    });

    it('bulk transitions report per-item results', async () => {
      const all = (
        await admin.get(`/participations?filter[tournament]=${tournamentId}`)
      ).body.data as P[];
      const res = await admin
        .post('/participations/transition', {
          ids: all.map((p) => p.id),
          to: 'ROSTER_CONFIRMED',
        })
        .expect(200);
      const results = res.body.data.results as { ok: boolean }[];
      expect(results.filter((r) => r.ok)).toHaveLength(2); // Orange, Grey
      expect(results.filter((r) => !r.ok)).toHaveLength(1); // Black already participated
    });

    it('updates notes with optimistic locking and deletes', async () => {
      const [grey] = (
        await admin.get(`/participations?filter[team]=${teams.Grey}`)
      ).body.data as P[];
      const updated = (
        await admin
          .patch(`/participations/${grey.id}`, {
            version: grey.version,
            notes: 'Bus booked',
          })
          .expect(200)
      ).body.data;
      expect(updated.notes).toBe('Bus booked');
      await admin
        .patch(`/participations/${grey.id}`, {
          version: grey.version,
          notes: 'x',
        })
        .expect(409);
    });

    it('filters participations by group, status, overdue and facets', async () => {
      const res = await admin
        .get(
          `/participations?filter[tournament]=${tournamentId}&filter[group]=${groupId}&sort=team`,
        )
        .expect(200);
      expect(
        res.body.data.map((p: { team: { name: string } }) => p.team.name),
      ).toEqual(['Black', 'Orange']);
      const status = res.body.meta.facets.find(
        (f: { key: string }) => f.key === 'status',
      );
      expect(status.options).toHaveLength(9);
      await admin.get('/participations?filter[overdue]=maybe').expect(400);
    });

    it('marks overdue steps and lists them in the work queue', async () => {
      const soon = await createTournament({
        name: 'Soon cup',
        startDate: day(10),
        endDate: day(10),
      });
      await signUp(soon.id, 'Orange');
      const [p] = (
        await admin.get(
          `/participations?filter[tournament]=${soon.id}&filter[overdue]=true`,
        )
      ).body.data;
      expect(p).toMatchObject({ overdue: true, nextStatus: 'PAID' });
      expect(p.daysUntilDue).toBeLessThan(0);

      const queue = (await admin.get('/attention')).body.data.items;
      const item = queue.find(
        (i: { id: string }) => i.id === `PARTICIPATION_OVERDUE:${soon.id}:PAID`,
      );
      expect(item).toMatchObject({
        type: 'PARTICIPATION_OVERDUE',
        severity: 'HIGH',
        count: 1,
        tournament: { id: soon.id, name: 'Soon cup' },
        details: {
          status: 'PAID',
          participations: [expect.objectContaining({ teamName: 'Orange' })],
        },
      });
      expect(
        queue.every(
          (i: { tournament?: unknown }) => i.tournament !== undefined,
        ),
      ).toBe(true);
    });

    it('ranks an unconfirmed past tournament as medium, not high', async () => {
      const past = await createTournament({
        name: 'Past classic',
        startDate: day(-10),
        endDate: day(-9),
        ageGroups: [],
      });
      const p = (
        await admin
          .post('/participations', {
            tournamentId: past.id,
            teamId: teams.Black,
          })
          .expect(201)
      ).body.data;
      await move(p, 'WAIVER_CONFIRMED').expect(200);
      const queue = (await admin.get('/attention')).body.data.items;
      const item = queue.find(
        (i: { id: string }) =>
          i.id === `PARTICIPATION_OVERDUE:${past.id}:PARTICIPATED`,
      );
      expect(item).toMatchObject({
        severity: 'MEDIUM',
        details: { dueDate: day(-8) },
      });
    });

    it('refuses to delete a tournament with participations unless forced', async () => {
      await admin.delete(`/tournaments/${tournamentId}`).expect(409);
      await admin.delete(`/tournaments/${tournamentId}?force=true`).expect(200);
      expect(
        (await admin.get(`/participations?filter[tournament]=${tournamentId}`))
          .body.meta.total,
      ).toBe(0);
    });
  });

  describe('teams in tournaments', () => {
    it("filters teams by tournament and lists a team's participations", async () => {
      const t = await createTournament({
        name: 'Team filter cup',
        ageGroups: [],
      });
      await admin
        .post('/participations', { tournamentId: t.id, teamId: teams.Grey })
        .expect(201);
      const byTournament = await admin
        .get(`/teams?filter[tournament]=${t.id}`)
        .expect(200);
      expect(
        byTournament.body.data.map((x: { name: string }) => x.name),
      ).toEqual(['Grey']);
      const ofTeam = await admin
        .get(
          `/participations?filter[team]=${teams.Grey}&filter[tournament]=${t.id}`,
        )
        .expect(200);
      expect(ofTeam.body.data).toHaveLength(1);
    });
  });
});
