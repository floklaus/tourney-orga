import { Client, createTestApp, TestContext } from './helpers';

describe('Team age groups from graduation year (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  const teams: Record<string, string> = {};
  let tournamentId: string;

  const thisYear = new Date().getFullYear();

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    for (const [name, graduationYear] of [
      ['Class 2031', 2031],
      ['Class 2032', 2032],
      ['Class 2033', 2033],
      ['Seniors', 2026],
      ['No year', null],
    ] as const) {
      teams[name] = (
        await admin
          .post('/teams', {
            name,
            contactName: 'C',
            email: `${name.replace(' ', '')}@t.test`,
            graduationYear,
          })
          .expect(201)
      ).body.data.id;
    }
    // School year 2026/27 (September rollover): the class of 2031 is in 8th grade
    tournamentId = (
      await admin
        .post('/tournaments', {
          name: 'Spring Shootout',
          startDate: '2027-06-10',
          endDate: '2027-06-11',
          ageGroups: ['U12', 'U14'],
        })
        .expect(201)
    ).body.data.id;
  });

  afterAll(() => ctx.app.close());

  it('calculates the current age group and validates the graduation year', async () => {
    await admin.patch('/settings', { seasonStartMonth: 1 }).expect(200);
    const team = (await admin.get(`/teams/${teams['Class 2031']}`)).body.data;
    expect(team).toMatchObject({
      graduationYear: 2031,
      ageGroup: `U${thisYear - 2031 + 18}`,
    });
    expect(
      (await admin.get(`/teams/${teams['No year']}`)).body.data.ageGroup,
    ).toBeNull();
    await admin
      .patch(`/teams/${teams['No year']}`, { graduationYear: 1999 })
      .expect(400);
    await admin.patch('/settings', { seasonStartMonth: 13 }).expect(400);
    await admin.patch('/settings', { seasonStartMonth: 9 }).expect(200);
    expect((await admin.get('/settings')).body.data.seasonStartMonth).toBe(9);
  });

  it('filters and sorts teams by age group', async () => {
    const res = await admin
      .get(`/teams?sort=ageGroup&filter[graduationYear]=2031,2033`)
      .expect(200);
    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual([
      'Class 2033',
      'Class 2031',
    ]);
    expect(
      res.body.meta.facets.find((f: { key: string }) => f.key === 'ageGroup')
        .label,
    ).toBe('Age group');
  });

  it('signs a team up in the age group matching its graduation year', async () => {
    const p = (
      await admin
        .post('/participations', {
          tournamentId,
          teamId: teams['Class 2031'],
        })
        .expect(201)
    ).body.data;
    expect(p).toMatchObject({
      ageGroup: 'U14',
      team: { graduationYear: 2031, ageGroup: 'U14' },
    });
    // Seniors are too old for any group: an age group has to be chosen
    await admin
      .post('/participations', { tournamentId, teamId: teams.Seniors })
      .expect(422);
  });

  it('bulk sign-up assigns each team its own age group unless one is chosen', async () => {
    const res = await admin
      .post('/participations/bulk', {
        tournamentId,
        teamIds: [
          teams['Class 2032'],
          teams['Class 2033'],
          teams.Seniors,
          teams['No year'],
        ],
      })
      .expect(201);
    const byTeam = Object.fromEntries(
      res.body.data.created.map(
        (p: { team: { name: string }; ageGroup: string }) => [
          p.team.name,
          p.ageGroup,
        ],
      ),
    );
    // Class of 2032 is U13 then and plays up in U14
    expect(byTeam).toEqual({ 'Class 2032': 'U14', 'Class 2033': 'U12' });
    expect(res.body.data.skipped).toEqual(
      expect.arrayContaining([
        {
          teamId: teams.Seniors,
          reason: 'No age group fits its graduation year: choose one',
        },
        {
          teamId: teams['No year'],
          reason: 'No age group fits its graduation year: choose one',
        },
      ]),
    );

    const chosen = await admin
      .post('/participations/bulk', {
        tournamentId,
        teamIds: [teams.Seniors],
        ageGroup: 'U14',
      })
      .expect(201);
    expect(chosen.body.data.created[0].ageGroup).toBe('U14');
  });

  it('imports and exports the graduation year', async () => {
    const bad = 'name,contactName,email,graduationYear\nX,C,x@t.test,20x0\n';
    expect(
      (
        await admin
          .post('/teams/import', { csv: bad, mode: 'create', dryRun: true })
          .expect(201)
      ).body.data.errors,
    ).toEqual([{ row: 2, message: 'invalid graduationYear "20x0"' }]);

    const csv =
      'name,contactName,email,graduationYear\n' +
      'Class 2031,C,Class2031@t.test,\n' +
      'No year,C,Noyear@t.test,2030\n';
    await admin
      .post('/teams/import', { csv, mode: 'upsert', dryRun: false })
      .expect(201);
    // An empty cell keeps the current value
    expect(
      (await admin.get(`/teams/${teams['Class 2031']}`)).body.data
        .graduationYear,
    ).toBe(2031);
    expect(
      (await admin.get(`/teams/${teams['No year']}`)).body.data.graduationYear,
    ).toBe(2030);
    const exported = (await admin.get('/teams/export')).text;
    expect(exported).toContain('No year,C,noyear@t.test,,2030\n');
  });
});
