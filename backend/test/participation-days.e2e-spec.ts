import { Client, createTestApp, TestContext } from './helpers';

describe('Participation days (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  const teams: string[] = [];
  let tournamentId: string;

  const days = ['2027-06-10', '2027-06-11', '2027-06-12'];

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    for (const name of ['Red', 'Blue', 'Green']) {
      teams.push(
        (
          await admin.post('/teams', {
            name,
            contactName: 'C',
            email: `${name}@t.test`,
          })
        ).body.data.id,
      );
    }
    tournamentId = (
      await admin
        .post('/tournaments', {
          name: 'Three Day Classic',
          startDate: days[0],
          endDate: days[2],
        })
        .expect(201)
    ).body.data.id;
  });

  afterAll(() => ctx.app.close());

  it('assigns all days by default, or the chosen ones', async () => {
    const all = (
      await admin
        .post('/participations', { tournamentId, teamId: teams[0] })
        .expect(201)
    ).body.data;
    expect(all.days).toEqual(days);

    const some = (
      await admin
        .post('/participations', {
          tournamentId,
          teamId: teams[1],
          days: ['2027-06-12', '2027-06-10', '2027-06-12'],
        })
        .expect(201)
    ).body.data;
    expect(some.days).toEqual(['2027-06-10', '2027-06-12']);
  });

  it('rejects no days, days outside the tournament and invalid dates', async () => {
    const post = (d: unknown) =>
      admin.post('/participations', {
        tournamentId,
        teamId: teams[2],
        days: d,
      });
    expect((await post([]).expect(422)).body.error.message).toBe(
      'Choose at least one day',
    );
    expect((await post(['2027-06-13']).expect(422)).body.error.message).toMatch(
      /2027-06-13 is not a day of the tournament/,
    );
    await post(['June 10']).expect(400);
  });

  it('bulk sign-up applies the chosen days to every team', async () => {
    const other = (
      await admin
        .post('/tournaments', {
          name: 'Weekend',
          startDate: '2027-07-03',
          endDate: '2027-07-04',
        })
        .expect(201)
    ).body.data.id;
    const res = await admin
      .post('/participations/bulk', {
        tournamentId: other,
        teamIds: teams,
        days: ['2027-07-04'],
      })
      .expect(201);
    expect(
      res.body.data.created.map((p: { days: string[] }) => p.days),
    ).toEqual([['2027-07-04'], ['2027-07-04'], ['2027-07-04']]);
  });

  it('updates the days and filters participations by day', async () => {
    const [p] = (
      await admin.get(
        `/participations?filter[tournament]=${tournamentId}&filter[team]=${teams[0]}`,
      )
    ).body.data;
    const updated = (
      await admin
        .patch(`/participations/${p.id}`, {
          version: p.version,
          days: ['2027-06-11'],
        })
        .expect(200)
    ).body.data;
    expect(updated.days).toEqual(['2027-06-11']);

    const res = await admin
      .get(
        `/participations?filter[tournament]=${tournamentId}&filter[day]=2027-06-10`,
      )
      .expect(200);
    expect(
      res.body.data.map((x: { team: { name: string } }) => x.team.name),
    ).toEqual(['Blue']);
    const facet = res.body.meta.facets.find(
      (f: { key: string }) => f.key === 'day',
    );
    expect(facet.options).toContainEqual(
      expect.objectContaining({
        value: '2027-06-11',
        label: 'Fri, Jun 11, 2027',
      }),
    );
  });

  it('moves the days along when the tournament dates change', async () => {
    await admin
      .patch(`/tournaments/${tournamentId}`, {
        startDate: '2027-08-01',
        endDate: '2027-08-02',
      })
      .expect(200);
    const list = (
      await admin.get(
        `/participations?filter[tournament]=${tournamentId}&sort=team`,
      )
    ).body.data;
    // Blue: 1st + 3rd day → only the 1st still exists; Red: 2nd day stays the 2nd
    expect(
      list.map((p: { team: { name: string }; days: string[] }) => [
        p.team.name,
        p.days,
      ]),
    ).toEqual([
      ['Blue', ['2027-08-01']],
      ['Red', ['2027-08-02']],
    ]);
  });

  it('renders {{participation.days}} and limits tournament length', async () => {
    const [blue] = (
      await admin.get(
        `/participations?filter[tournament]=${tournamentId}&filter[team]=${teams[1]}`,
      )
    ).body.data;
    const preview = (
      await admin
        .post('/templates/preview', {
          subject: 'Days',
          bodyHtml: '<p>You play on {{participation.days}}.</p>',
          participationId: blue.id,
        })
        .expect(200)
    ).body.data;
    expect(preview.html).toMatch(/You play on 1\. Aug\. 2027\./);

    await admin
      .post('/tournaments', {
        name: 'Endless',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
      })
      .expect(422);
  });
});
