import {
  findInvalidPlaceholders,
  findTournamentVars,
  RenderContext,
  renderTemplate,
  sanitizeBody,
} from './placeholders';

describe('findInvalidPlaceholders', () => {
  it('accepts known placeholders and tournament variables', () => {
    expect(
      findInvalidPlaceholders(
        'Hi {{team.contactName}}, {{ tournament.vars.venue }} {{tournament.name}} {{tournament.startDate}} {{participation.ageGroup}} {{unsubscribeUrl}}',
      ),
    ).toEqual([]);
  });

  it('reports unknown placeholders, including the removed campaign ones', () => {
    expect(
      findInvalidPlaceholders('{{team.captain}} {{campaign.vars.venue}}'),
    ).toEqual(['team.captain', 'campaign.vars.venue']);
  });

  it('rejects block helpers and triple mustaches', () => {
    expect(
      findInvalidPlaceholders('{{#if team.name}}x{{/if}} {{{team.name}}}'),
    ).toEqual(['#if team.name', '/if', '{team.name']);
  });
});

describe('findTournamentVars', () => {
  it('lists distinct tournament variable keys', () => {
    expect(
      findTournamentVars(
        '{{tournament.vars.venue}} {{tournament.vars.time}} {{tournament.vars.venue}}',
      ),
    ).toEqual(['venue', 'time']);
  });
});

describe('renderTemplate', () => {
  const ctx: RenderContext = {
    team: { name: 'A&B <FC>', contactName: 'Kim' },
    tournament: {
      name: 'Cup',
      startDate: '20.06.2026',
      endDate: '21.06.2026',
      url: 'https://x.test',
      vars: { venue: 'Hall 1' },
    },
    participation: { ageGroup: 'U12', days: '20.06.2026' },
    organizer: { name: 'Org' },
    unsubscribeUrl: 'https://x.test/u/abc',
  };

  it('escapes values in HTML mode', () => {
    expect(
      renderTemplate(
        '<p>{{team.name}} @ {{tournament.vars.venue}} ({{participation.ageGroup}})</p>',
        ctx,
        'html',
      ),
    ).toBe('<p>A&amp;B &lt;FC&gt; @ Hall 1 (U12)</p>');
  });

  it('does not escape in text mode and strips newlines', () => {
    expect(renderTemplate('Hello {{team.name}}\n', ctx, 'text')).toBe(
      'Hello A&B <FC> ',
    );
  });

  it('renders missing values as empty strings', () => {
    expect(renderTemplate('[{{tournament.vars.missing}}]', ctx, 'html')).toBe(
      '[]',
    );
  });
});

describe('sanitizeBody', () => {
  it('removes scripts, event handlers and javascript links', () => {
    expect(
      sanitizeBody(
        '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      ),
    ).toBe('<p>Hi</p><a>x</a>');
  });

  it('keeps placeholders inside links', () => {
    expect(sanitizeBody('<a href="{{unsubscribeUrl}}">Unsubscribe</a>')).toBe(
      '<a href="{{unsubscribeUrl}}">Unsubscribe</a>',
    );
  });
});
