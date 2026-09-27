import { EmailDelivery } from '../src/modules/delivery/email-delivery.entity';
import { Client, createTestApp, sendStepNow, TestContext } from './helpers';

describe('Teams, groups & templates (e2e)', () => {
  let ctx: TestContext;
  let admin: Client;
  let groupA: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await Client.login(ctx.app);
    groupA = (await admin.post('/groups', { name: 'Summer Cup' }).expect(201))
      .body.data.id;
  });

  afterAll(() => ctx.app.close());

  describe('teams', () => {
    let teamId: string;

    it('creates a team with normalized emails and groups', async () => {
      const res = await admin
        .post('/teams', {
          name: ' FC Alpha ',
          contactName: 'Ann',
          email: 'ANN@alpha.test',
          ccEmails: ['Coach@Alpha.test'],
          groupIds: [groupA],
        })
        .expect(201);
      teamId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        name: 'FC Alpha',
        email: 'ann@alpha.test',
        ccEmails: ['coach@alpha.test'],
        groups: [{ id: groupA, name: 'Summer Cup' }],
        unsubscribedAt: null,
      });
      expect(res.body.data.unsubscribeToken).toBeUndefined();
    });

    it('rejects duplicates, invalid emails and too many CCs', async () => {
      await admin
        .post('/teams', {
          name: 'FC Alpha',
          contactName: 'X',
          email: 'x@x.test',
        })
        .expect(409);
      await admin
        .post('/teams', { name: 'Bad', contactName: 'X', email: 'nope' })
        .expect(400);
      await admin
        .post('/teams', {
          name: 'Many',
          contactName: 'X',
          email: 'x@x.test',
          ccEmails: Array(6).fill('a@b.test'),
        })
        .expect(400);
    });

    it('lists with search, group filter, pagination and archive toggle', async () => {
      await admin
        .post('/teams', {
          name: 'Beta United',
          contactName: 'Ben',
          email: 'ben@beta.test',
        })
        .expect(201);
      const search = await admin.get('/teams?search=beta').expect(200);
      expect(search.body.data.map((t: { name: string }) => t.name)).toEqual([
        'Beta United',
      ]);
      expect(search.body.meta).toMatchObject({ total: 1, page: 1, limit: 25 });

      const byGroup = await admin
        .get(`/teams?filter[group]=${groupA}`)
        .expect(200);
      expect(byGroup.body.data.map((t: { name: string }) => t.name)).toEqual([
        'FC Alpha',
      ]);

      await admin.patch(`/teams/${teamId}`, { isArchived: true }).expect(200);
      expect((await admin.get('/teams').expect(200)).body.meta.total).toBe(1);
      expect(
        (await admin.get('/teams?filter[archived]=true,false').expect(200)).body
          .meta.total,
      ).toBe(2);
      await admin.patch(`/teams/${teamId}`, { isArchived: false }).expect(200);

      const page = await admin.get('/teams?limit=1&page=2').expect(200);
      expect(page.body.data).toHaveLength(1);
    });

    it('updates only the given fields', async () => {
      const res = await admin
        .patch(`/teams/${teamId}`, { notes: 'Pays late' })
        .expect(200);
      expect(res.body.data).toMatchObject({
        name: 'FC Alpha',
        notes: 'Pays late',
        groups: [{ id: groupA }],
      });
    });

    it('reports group team counts', async () => {
      const groups = await admin.get('/groups').expect(200);
      expect(groups.body.data).toEqual([
        { id: groupA, name: 'Summer Cup', description: null, teamCount: 1 },
      ]);
      await admin.post('/groups', { name: 'Summer Cup' }).expect(409);
    });

    it('imports CSV with dry run, validation errors and upsert', async () => {
      const bad =
        'name,contactName,email,ccEmails,groups\nGamma,Gus,not-an-email,,\n';
      const badRes = await admin
        .post('/teams/import', { csv: bad, mode: 'create', dryRun: false })
        .expect(201);
      expect(badRes.body.data.errors).toEqual([
        { row: 2, message: 'invalid email "not-an-email"' },
      ]);

      const csv =
        'name,contactName,email,ccEmails,groups\n' +
        'Gamma,Gus,gus@gamma.test,a@gamma.test;b@gamma.test,Summer Cup;Youth\n' +
        'FC Alpha,Anna,anna@alpha.test,,Youth\n';
      const dry = await admin
        .post('/teams/import', { csv, mode: 'upsert', dryRun: true })
        .expect(201);
      expect(dry.body.data).toEqual({ created: 1, updated: 1, errors: [] });
      expect((await admin.get('/teams?search=gamma')).body.meta.total).toBe(0);

      const createOnly = await admin
        .post('/teams/import', { csv, mode: 'create', dryRun: false })
        .expect(201);
      expect(createOnly.body.data.errors).toEqual([
        { row: 3, message: 'team "FC Alpha" already exists' },
      ]);

      await admin
        .post('/teams/import', { csv, mode: 'upsert', dryRun: false })
        .expect(201);
      const gamma = (await admin.get('/teams?search=gamma')).body.data[0];
      expect(gamma.ccEmails).toEqual(['a@gamma.test', 'b@gamma.test']);
      expect(gamma.groups.map((g: { name: string }) => g.name)).toEqual([
        'Summer Cup',
        'Youth',
      ]);
      const alpha = (await admin.get(`/teams/${teamId}`)).body.data;
      expect(alpha.contactName).toBe('Anna');
      expect(alpha.groups.map((g: { name: string }) => g.name)).toEqual([
        'Summer Cup',
        'Youth',
      ]);
    });

    it('exports CSV', async () => {
      const res = await admin.get('/teams/export').expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.split('\n')[0]).toBe(
        'name,contactName,email,ccEmails,graduationYear,groups',
      );
      expect(res.text).toContain(
        'Gamma,Gus,gus@gamma.test,a@gamma.test;b@gamma.test,,Summer Cup;Youth',
      );
    });

    it('deletes a team together with its participations and emails', async () => {
      const team = (
        await admin.post('/teams', {
          name: 'Temp',
          contactName: 'T',
          email: 't@t.test',
        })
      ).body.data;
      const sent = await sendStepNow(admin, ctx.scheduler, {
        teamIds: [team.id],
      });
      await admin.delete(`/teams/${team.id}`).expect(200);
      const left = await ctx.dataSource
        .getRepository(EmailDelivery)
        .find({ where: { step: { id: sent.steps[0].id } } });
      expect(left).toHaveLength(0);
    });

    it('deletes groups', async () => {
      const g = (await admin.post('/groups', { name: 'Temp group' })).body.data;
      await admin.patch(`/groups/${g.id}`, { description: 'x' }).expect(200);
      await admin.delete(`/groups/${g.id}`).expect(200);
      await admin.delete(`/groups/${g.id}`).expect(404);
    });
  });

  describe('templates', () => {
    let templateId: string;

    it('lists placeholders', async () => {
      const res = await admin.get('/templates/placeholders').expect(200);
      expect(res.body.data.map((p: { key: string }) => p.key)).toContain(
        'team.contactName',
      );
    });

    it('rejects unknown placeholders with 422 naming them', async () => {
      const res = await admin
        .post('/templates', {
          name: 'Bad',
          subject: 'Hi {{team.captain}}',
          bodyHtml: '<p>{{#if x}}</p>',
        })
        .expect(422);
      expect(res.body.error.message).toBe(
        'Unknown placeholder(s): {{team.captain}}, {{#if x}}',
      );
      expect(res.body.error.details).toEqual({
        invalid: ['team.captain', '#if x'],
      });
    });

    it('sanitizes the body and generates plain text', async () => {
      const res = await admin
        .post('/templates', {
          name: 'Invite',
          subject: 'Invitation for {{team.name}}',
          bodyHtml:
            '<p>Hello {{team.contactName}}<script>x()</script></p><p>See {{tournament.vars.venue}}</p>',
        })
        .expect(201);
      templateId = res.body.data.id;
      expect(res.body.data.bodyHtml).toBe(
        '<p>Hello {{team.contactName}}</p><p>See {{tournament.vars.venue}}</p>',
      );
      expect(res.body.data.bodyText).toContain('Hello {{team.contactName}}');
    });

    it('previews with sample data or a real team', async () => {
      const sample = await admin
        .post('/templates/preview', {
          subject: 'Hi {{team.name}}',
          bodyHtml: '<p>{{team.contactName}} {{tournament.vars.venue}}</p>',
        })
        .expect(200);
      expect(sample.body.data.subject).toBe('Hi FC Example');
      expect(sample.body.data.html).toContain('Alex Sample Main Hall');
      expect(sample.body.data.html).toContain('Unsubscribe');

      const team = (await admin.get('/teams?search=gamma')).body.data[0];
      const real = await admin
        .post('/templates/preview', {
          subject: 'Hi {{team.name}}',
          bodyHtml: '<p>x</p>',
          teamId: team.id,
        })
        .expect(200);
      expect(real.body.data.subject).toBe('Hi Gamma');
    });

    it('sends a test email to the current user', async () => {
      await admin
        .post('/templates/test-send', {
          subject: 'Hello',
          bodyHtml: '<p>x</p>',
        })
        .expect(200);
      expect(ctx.mail.lastTo('admin@example.com')?.subject).toBe(
        '[TEST] Hello',
      );
    });

    it('updates, duplicates and protects templates in use', async () => {
      await admin
        .patch(`/templates/${templateId}`, { subject: 'New {{team.name}}' })
        .expect(200);
      const copy = await admin
        .post(`/templates/${templateId}/duplicate`)
        .expect(201);
      expect(copy.body.data.name).toBe('Invite (copy)');
      const copy2 = await admin
        .post(`/templates/${templateId}/duplicate`)
        .expect(201);
      expect(copy2.body.data.name).toBe('Invite (copy) 2');

      const start = new Date(Date.now() + 30 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const tournament = (
        await admin.post('/tournaments', {
          name: 'In use',
          startDate: start,
          endDate: start,
        })
      ).body.data;
      const team = (await admin.get('/teams?search=gamma')).body.data[0];
      const participation = (
        await admin
          .post('/participations', {
            tournamentId: tournament.id,
            teamId: team.id,
          })
          .expect(201)
      ).body.data;
      await admin
        .post(`/participations/${participation.id}/steps`, {
          name: 'S',
          templateId,
          timingType: 'ABSOLUTE',
          sendAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(201);
      await admin.delete(`/templates/${templateId}`).expect(409);
      await admin.delete(`/templates/${copy.body.data.id}`).expect(200);
      const names = (await admin.get('/templates')).body.data.map(
        (t: { name: string }) => t.name,
      );
      expect(names.filter((n: string) => n.startsWith('Invite'))).toEqual([
        'Invite',
        'Invite (copy) 2',
      ]);
    });
  });
});
