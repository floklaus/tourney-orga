import { unprocessable } from '../../common/errors';
import { findTournamentVars } from '../template/domain/placeholders';
import { EmailStep, UNSENT_STEP_STATUSES } from './email-step.entity';

export const hasValue = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** Per-team overrides win over the tournament's values; blank overrides count as "no override". */
export function effectiveVariables(
  tournamentVars: Record<string, string>,
  overrides: Record<string, string>,
): Record<string, string> {
  const result = { ...tournamentVars };
  for (const [key, value] of Object.entries(overrides))
    if (hasValue(value)) result[key] = value;
  return result;
}

/** Subject and body a step sends: its template, with an optional subject override. */
export function stepContent(
  step: Pick<EmailStep, 'subjectOverride' | 'template'>,
): { subject: string; bodyHtml: string } | null {
  const subject = step.subjectOverride ?? step.template?.subject;
  const bodyHtml = step.template?.bodyHtml;
  return subject && bodyHtml ? { subject, bodyHtml } : null;
}

/** Tournament variables the step's effective content uses, sorted. */
export function requiredVariablesOf(
  step: Pick<EmailStep, 'subjectOverride' | 'template'>,
): string[] {
  const content = stepContent(step);
  return content
    ? findTournamentVars(`${content.subject}\n${content.bodyHtml}`).sort()
    : [];
}

export function missingVariablesOf(
  step: Pick<EmailStep, 'subjectOverride' | 'template'>,
  variables: Record<string, string>,
): string[] {
  return requiredVariablesOf(step).filter((key) => !hasValue(variables[key]));
}

export interface RequiredVariable {
  key: string;
  value: string | null;
  source: 'PARTICIPATION' | 'TOURNAMENT' | null;
  steps: { id: string; name: string }[];
}

/** Variables used by a participation's unsent steps, with the value and where it comes from. */
export function participationVariables(
  steps: EmailStep[],
  tournamentVars: Record<string, string>,
  overrides: Record<string, string>,
): { requiredVariables: RequiredVariable[]; missingVariables: string[] } {
  const usage = new Map<string, { id: string; name: string }[]>();
  for (const step of steps.filter((s) =>
    UNSENT_STEP_STATUSES.includes(s.status),
  )) {
    for (const key of requiredVariablesOf(step))
      usage.set(key, [
        ...(usage.get(key) ?? []),
        { id: step.id, name: step.name },
      ]);
  }
  const requiredVariables = [...usage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, usedBy]): RequiredVariable => {
      if (hasValue(overrides[key]))
        return {
          key,
          value: overrides[key],
          source: 'PARTICIPATION',
          steps: usedBy,
        };
      if (hasValue(tournamentVars[key]))
        return {
          key,
          value: tournamentVars[key],
          source: 'TOURNAMENT',
          steps: usedBy,
        };
      return { key, value: null, source: null, steps: usedBy };
    });
  return {
    requiredVariables,
    missingVariables: requiredVariables
      .filter((v) => v.source === null)
      .map((v) => v.key),
  };
}

const VARIABLE_KEY = /^[A-Za-z0-9_]{1,50}$/;

/** Validates variable maps from clients: simple keys, string values (max 2000 chars). */
export function normalizeVariables(
  input: Record<string, unknown> | undefined,
): {
  value: Record<string, string>;
  invalid: string[];
} {
  const entries = Object.entries(input ?? {});
  const invalid = entries
    .filter(
      ([key, value]) => !VARIABLE_KEY.test(key) || typeof value !== 'string',
    )
    .map(([k]) => k);
  return {
    value: Object.fromEntries(
      entries.map(([k, v]) => [k, String(v).slice(0, 2000)]),
    ),
    invalid,
  };
}

export const missingVariablesError = (missingVariables: string[]) =>
  unprocessable(
    `Missing tournament variable(s): ${missingVariables.join(', ')}`,
    { missingVariables },
  );

/** Validated variable map, or 422 naming the invalid keys. */
export function checkVariables(
  input: Record<string, unknown> | undefined,
): Record<string, string> {
  const { value, invalid } = normalizeVariables(input);
  if (invalid.length > 0) {
    throw unprocessable(
      'Variable keys must be letters, digits or _ (max 50) and values must be text',
      { invalid },
    );
  }
  return value;
}
