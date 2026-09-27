import sanitizeHtml from 'sanitize-html';

export const PLACEHOLDERS: ReadonlyArray<{ key: string; description: string }> =
  [
    { key: 'team.name', description: 'Team name' },
    { key: 'team.contactName', description: 'Name of the team contact person' },
    { key: 'tournament.name', description: 'Tournament name' },
    {
      key: 'tournament.startDate',
      description: 'Tournament start date (formatted)',
    },
    {
      key: 'tournament.endDate',
      description: 'Tournament end date (formatted)',
    },
    { key: 'tournament.url', description: 'Tournament website' },
    {
      key: 'tournament.vars.<key>',
      description:
        'Tournament variable (a team can override it), e.g. tournament.vars.venue',
    },
    {
      key: 'participation.ageGroup',
      description: "The team's age group at this tournament",
    },
    {
      key: 'participation.days',
      description: 'The tournament days the team plays on (formatted)',
    },
    { key: 'organizer.name', description: 'Organizer name from settings' },
    {
      key: 'unsubscribeUrl',
      description: 'Personal unsubscribe link of the team',
    },
  ];

const FIXED_KEYS = new Set(
  PLACEHOLDERS.map((p) => p.key).filter((k) => !k.includes('<')),
);
const TOURNAMENT_VAR = /^tournament\.vars\.([A-Za-z0-9_]+)$/;
const ANY_MUSTACHE = /\{\{\s*([^}]*?)\s*\}\}/g;
const SIMPLE_MUSTACHE = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export interface RenderContext {
  team: { name: string; contactName: string };
  tournament: {
    name: string;
    startDate: string;
    endDate: string;
    url: string;
    vars: Record<string, string>;
  };
  participation: { ageGroup: string; days: string };
  organizer: { name: string };
  unsubscribeUrl: string;
}

function isAllowedKey(key: string): boolean {
  return FIXED_KEYS.has(key) || TOURNAMENT_VAR.test(key);
}

/** Returns every `{{…}}` expression that is not a supported placeholder. */
export function findInvalidPlaceholders(source: string): string[] {
  return [...source.matchAll(ANY_MUSTACHE)]
    .map((m) => m[1])
    .filter((key) => !isAllowedKey(key));
}

export function findTournamentVars(source: string): string[] {
  const keys = [...source.matchAll(SIMPLE_MUSTACHE)]
    .map((m) => TOURNAMENT_VAR.exec(m[1])?.[1])
    .filter((k): k is string => Boolean(k));
  return [...new Set(keys)];
}

function lookup(ctx: RenderContext, key: string): string {
  const varMatch = TOURNAMENT_VAR.exec(key);
  if (varMatch) {
    return ctx.tournament.vars[varMatch[1]] ?? '';
  }
  const value = key
    .split('.')
    .reduce<unknown>(
      (obj, part) => (obj as Record<string, unknown> | undefined)?.[part],
      ctx,
    );
  return typeof value === 'string' ? value : '';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Replaces placeholders with context values. `html` escapes values;
 * `text` (for subjects) leaves them raw but removes line breaks so nothing
 * can inject extra mail headers.
 */
export function renderTemplate(
  source: string,
  ctx: RenderContext,
  mode: 'html' | 'text',
): string {
  const rendered = source.replace(SIMPLE_MUSTACHE, (_match, key: string) => {
    const value = lookup(ctx, key);
    return mode === 'html' ? escapeHtml(value) : value;
  });
  return mode === 'text' ? rendered.replace(/[\r\n]+/g, ' ') : rendered;
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'hr',
    'span',
    'div',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
};

export function sanitizeBody(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
