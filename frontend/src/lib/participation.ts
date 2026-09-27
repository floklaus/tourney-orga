// Participation process: step order, labels and the client-side copy of the state machine
// (api-contract v1.3). The server is authoritative: a 409 carries `details.allowed`.

import { isApiError } from "./api";
import { addDays, dayNumber } from "./days";
import type { MilestoneInput, Participation, ParticipationStatus, ProcessStatus } from "./participation-types";

export const PROCESS_ORDER: ProcessStatus[] = [
  "SIGNED_UP",
  "PAID",
  "ADDED_TO_SPORTSENGINE",
  "ADDED_TO_STAFF_CALENDAR",
  "ROSTER_CONFIRMED",
  "WAIVER_REQUESTED",
  "WAIVER_CONFIRMED",
  "PARTICIPATED",
];

export const ALL_STATUSES: ParticipationStatus[] = [...PROCESS_ORDER, "WITHDRAWN"];

/** Fallback labels; responses carry the server's labels in `steps` / `milestones`. */
export const STATUS_LABELS: Record<ParticipationStatus, string> = {
  SIGNED_UP: "Signed up",
  PAID: "Paid",
  ADDED_TO_SPORTSENGINE: "Added to SportsEngine",
  ADDED_TO_STAFF_CALENDAR: "Added to staff calendar",
  ROSTER_CONFIRMED: "Roster confirmed",
  WAIVER_REQUESTED: "Waiver requested",
  WAIVER_CONFIRMED: "Waiver confirmed",
  PARTICIPATED: "Participated",
  WITHDRAWN: "Withdrawn",
};

export function statusLabel(status: ParticipationStatus, p?: Pick<Participation, "steps">): string {
  return p?.steps.find((s) => s.status === status)?.label ?? STATUS_LABELS[status];
}

export const statusIndex = (status: ParticipationStatus) => PROCESS_ORDER.indexOf(status as ProcessStatus);

/** "3/8" progress of a non-withdrawn participation. */
export function progressOf(status: ParticipationStatus): { step: number; total: number } | null {
  const index = statusIndex(status);
  return index < 0 ? null : { step: index + 1, total: PROCESS_ORDER.length };
}

/** Status held before withdrawing: the last step that has a completion date (fallback: first step). */
export function reinstateTarget(p: Pick<Participation, "steps">): ProcessStatus {
  const reached = PROCESS_ORDER.filter((status) => p.steps.some((s) => s.status === status && s.completedAt));
  return reached[reached.length - 1] ?? PROCESS_ORDER[0];
}

export interface AllowedTransitions {
  forward: ProcessStatus[];
  back: ProcessStatus | null;
  withdraw: boolean;
  reinstate: ProcessStatus | null;
}

/**
 * Forward: any later status from a non-terminal one. Back: exactly one step, not from PARTICIPATED.
 * Withdraw: from any non-terminal status. Reinstate: WITHDRAWN -> the status held before.
 */
export function allowedTransitions(p: Pick<Participation, "status" | "steps">): AllowedTransitions {
  if (p.status === "WITHDRAWN") return { forward: [], back: null, withdraw: false, reinstate: reinstateTarget(p) };
  if (p.status === "PARTICIPATED") return { forward: [], back: null, withdraw: false, reinstate: null };
  const index = statusIndex(p.status);
  return {
    forward: PROCESS_ORDER.slice(index + 1),
    back: index > 0 ? PROCESS_ORDER[index - 1] : null,
    withdraw: true,
    reinstate: null,
  };
}

/** `details.allowed` of a 409 invalid-transition error, or null. */
export function allowedFromConflict(error: unknown): ParticipationStatus[] | null {
  if (!isApiError(error) || error.status !== 409) return null;
  const allowed = (error.details as { allowed?: unknown } | null | undefined)?.allowed;
  return Array.isArray(allowed) ? allowed.filter((s): s is ParticipationStatus => typeof s === "string") : null;
}

export function milestoneDueDate(m: Pick<MilestoneInput, "offsetDays" | "anchor">, startDate: string, endDate: string): string {
  return addDays(m.anchor === "START" ? startDate : endDate, m.offsetDays);
}

/** Statuses whose due date is earlier than the previous step's (the server rejects these with 422). */
export function milestoneOrderErrors(milestones: MilestoneInput[], startDate: string, endDate: string): Set<ProcessStatus> {
  const errors = new Set<ProcessStatus>();
  if (Number.isNaN(dayNumber(startDate)) || Number.isNaN(dayNumber(endDate))) return errors;
  let previous = Number.NEGATIVE_INFINITY;
  sortMilestones(milestones).forEach((m) => {
    const due = dayNumber(milestoneDueDate(m, startDate, endDate));
    if (due < previous) errors.add(m.status);
    previous = Math.max(previous, due);
  });
  return errors;
}

export function sortMilestones<M extends { status: ProcessStatus }>(milestones: M[]): M[] {
  return [...milestones].sort((a, b) => statusIndex(a.status) - statusIndex(b.status));
}

export function describeMilestoneOffset(m: Pick<MilestoneInput, "offsetDays" | "anchor">): string {
  const anchor = m.anchor === "START" ? "start" : "end";
  if (m.offsetDays === 0) return `On the ${anchor} date`;
  const days = Math.abs(m.offsetDays);
  return `${days} ${days === 1 ? "day" : "days"} ${m.offsetDays < 0 ? "before" : "after"} ${anchor}`;
}

/** "Due in 3 days" / "Due today" / "5 days overdue". */
export function describeDue(daysUntilDue: number | null): string {
  if (daysUntilDue === null) return "";
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue < 0) return `${-daysUntilDue} ${daysUntilDue === -1 ? "day" : "days"} overdue`;
  return `Due in ${daysUntilDue} ${daysUntilDue === 1 ? "day" : "days"}`;
}
