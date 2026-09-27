import { DateTime } from 'luxon';

export enum ParticipationStatus {
  SIGNED_UP = 'SIGNED_UP',
  PAID = 'PAID',
  ADDED_TO_SPORTSENGINE = 'ADDED_TO_SPORTSENGINE',
  ADDED_TO_STAFF_CALENDAR = 'ADDED_TO_STAFF_CALENDAR',
  ROSTER_CONFIRMED = 'ROSTER_CONFIRMED',
  WAIVER_REQUESTED = 'WAIVER_REQUESTED',
  WAIVER_CONFIRMED = 'WAIVER_CONFIRMED',
  PARTICIPATED = 'PARTICIPATED',
  WITHDRAWN = 'WITHDRAWN',
}

const S = ParticipationStatus;

/** The process steps in order. WITHDRAWN is a side exit, not a step. */
export const PROCESS: ParticipationStatus[] = [
  S.SIGNED_UP,
  S.PAID,
  S.ADDED_TO_SPORTSENGINE,
  S.ADDED_TO_STAFF_CALENDAR,
  S.ROSTER_CONFIRMED,
  S.WAIVER_REQUESTED,
  S.WAIVER_CONFIRMED,
  S.PARTICIPATED,
];

export const STATUS_LABELS: Record<ParticipationStatus, string> = {
  SIGNED_UP: 'Signed up',
  PAID: 'Paid',
  ADDED_TO_SPORTSENGINE: 'Added to SportsEngine',
  ADDED_TO_STAFF_CALENDAR: 'Added to staff calendar',
  ROSTER_CONFIRMED: 'Roster confirmed with families',
  WAIVER_REQUESTED: 'Waiver request sent',
  WAIVER_CONFIRMED: 'Waiver submission confirmed',
  PARTICIPATED: 'Participated',
  WITHDRAWN: 'Withdrawn',
};

export const TERMINAL: ParticipationStatus[] = [S.PARTICIPATED, S.WITHDRAWN];

export type MilestoneAnchor = 'START' | 'END';

export interface MilestoneRule {
  status: ParticipationStatus;
  offsetDays: number;
  anchor: MilestoneAnchor;
}

export const DEFAULT_MILESTONES: MilestoneRule[] = [
  { status: S.SIGNED_UP, offsetDays: -90, anchor: 'START' },
  { status: S.PAID, offsetDays: -75, anchor: 'START' },
  { status: S.ADDED_TO_SPORTSENGINE, offsetDays: -60, anchor: 'START' },
  { status: S.ADDED_TO_STAFF_CALENDAR, offsetDays: -56, anchor: 'START' },
  { status: S.ROSTER_CONFIRMED, offsetDays: -30, anchor: 'START' },
  { status: S.WAIVER_REQUESTED, offsetDays: -21, anchor: 'START' },
  { status: S.WAIVER_CONFIRMED, offsetDays: -7, anchor: 'START' },
  { status: S.PARTICIPATED, offsetDays: 1, anchor: 'END' },
];

export interface TournamentDates {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

const orderOf = (status: ParticipationStatus) => PROCESS.indexOf(status);

/**
 * Targets reachable from `current`: any later step, one step back (undo) and withdrawing.
 * A withdrawn participation can only be reinstated to the status it had before.
 */
export function allowedTransitions(
  current: ParticipationStatus,
  statusBeforeWithdrawal: ParticipationStatus | null,
): ParticipationStatus[] {
  if (current === S.WITHDRAWN)
    return statusBeforeWithdrawal ? [statusBeforeWithdrawal] : [S.SIGNED_UP];
  if (current === S.PARTICIPATED) return [];
  const index = orderOf(current);
  return [
    ...PROCESS.slice(index + 1),
    ...(index > 0 ? [PROCESS[index - 1]] : []),
    S.WITHDRAWN,
  ];
}

/** The status changes to record for a transition; jumping forward records every skipped step. */
export function transitionPath(
  from: ParticipationStatus,
  to: ParticipationStatus,
): ParticipationStatus[] {
  if (from === S.WITHDRAWN || to === S.WITHDRAWN) return [to];
  const [a, b] = [orderOf(from), orderOf(to)];
  return b > a ? PROCESS.slice(a + 1, b + 1) : [to];
}

export function dueDateOf(rule: MilestoneRule, dates: TournamentDates): string {
  const anchor = rule.anchor === 'END' ? dates.endDate : dates.startDate;
  return DateTime.fromISO(anchor, { zone: 'UTC' })
    .plus({ days: rule.offsetDays })
    .toISODate()!;
}

/** Steps whose due date lies before the previous step's due date. */
export function milestoneOrderProblems(
  rules: MilestoneRule[],
  dates: TournamentDates,
): ParticipationStatus[] {
  const due = PROCESS.map((status) => {
    const rule = rules.find((r) => r.status === status);
    return rule ? dueDateOf(rule, dates) : null;
  });
  return PROCESS.filter(
    (_, i) =>
      i > 0 && due[i] !== null && due[i - 1] !== null && due[i] < due[i - 1]!,
  );
}

export type StepState = 'DONE' | 'NEXT' | 'OVERDUE' | 'UPCOMING' | 'WITHDRAWN';

export interface ComputedStep {
  status: ParticipationStatus;
  label: string;
  dueDate: string;
  completedAt: string | null;
  state: StepState;
}

export interface ComputedProgress {
  steps: ComputedStep[];
  nextStatus: ParticipationStatus | null;
  nextDueDate: string | null;
  overdue: boolean;
  daysUntilDue: number | null;
}

/**
 * Due dates and states of all 8 steps. `completedAt` is the date (in `timezone`) the step
 * was last reached according to the history. `today` is YYYY-MM-DD in the same timezone.
 */
export function computeSteps(
  status: ParticipationStatus,
  rules: MilestoneRule[],
  dates: TournamentDates,
  history: { toStatus: ParticipationStatus; changedAt: Date }[],
  today: string,
  timezone: string,
): ComputedProgress {
  const withdrawn = status === S.WITHDRAWN;
  const reached = withdrawn ? lastActiveStatus(history) : status;
  const reachedIndex = reached ? orderOf(reached) : -1;
  const nextIndex =
    withdrawn || status === S.PARTICIPATED ? -1 : reachedIndex + 1;

  const steps = PROCESS.map((step, index): ComputedStep => {
    const rule =
      rules.find((r) => r.status === step) ?? DEFAULT_MILESTONES[index];
    const dueDate = dueDateOf(rule, dates);
    const lastReached = [...history].reverse().find((h) => h.toStatus === step);
    const done = index <= reachedIndex;
    const state: StepState = done
      ? 'DONE'
      : withdrawn
        ? 'WITHDRAWN'
        : index === nextIndex
          ? dueDate < today
            ? 'OVERDUE'
            : 'NEXT'
          : 'UPCOMING';
    return {
      status: step,
      label: STATUS_LABELS[step],
      dueDate,
      completedAt:
        done && lastReached
          ? DateTime.fromJSDate(lastReached.changedAt, {
              zone: timezone,
            }).toISODate()
          : null,
      state,
    };
  });

  const next = nextIndex >= 0 ? steps[nextIndex] : null;
  return {
    steps,
    nextStatus: next?.status ?? null,
    nextDueDate: next?.dueDate ?? null,
    overdue: next?.state === 'OVERDUE',
    daysUntilDue: next
      ? Math.round(
          DateTime.fromISO(next.dueDate).diff(DateTime.fromISO(today), 'days')
            .days,
        )
      : null,
  };
}

/** The last process status before a withdrawal (for reinstating and showing progress). */
export function lastActiveStatus(
  history: { toStatus: ParticipationStatus }[],
): ParticipationStatus | null {
  return (
    [...history].reverse().find((h) => h.toStatus !== S.WITHDRAWN)?.toStatus ??
    null
  );
}
