// Pure layout model of the participation Gantt chart: time scale, ticks, grouped rows.
import { dayNumber, dayOfInstant, formatDayShort, fromDayNumber } from "@/lib/days";
import { statusLabel } from "@/lib/participation";
import type { Participation, StepState } from "@/lib/types";

export type GanttZoom = "week" | "month";

export const PX_PER_DAY: Record<GanttZoom, number> = { week: 18, month: 5 };
const PAD_BEFORE_DAYS = 7;
const PAD_AFTER_DAYS = 14;

export interface GanttScale {
  startDay: number;
  days: number;
  pxPerDay: number;
  width: number;
  /** Left edge of a day. */
  x: (day: number) => number;
}

export interface Tick {
  day: number;
  x: number;
  label: string;
}

export interface MarkerModel {
  status: string;
  label: string;
  state: StepState;
  x: number;
  /** Actual completion day, if different from nothing. */
  completedX: number | null;
  text: string;
}

/** The participation's next planned email (from `emails.nextSendAt`). */
export interface EmailMarkModel {
  x: number;
  text: string;
}

export interface RowModel {
  participation: Participation;
  nextEmail: EmailMarkModel | null;
  label: string;
  withdrawn: boolean;
  lineFrom: number;
  barStart: number;
  barEnd: number;
  markers: MarkerModel[];
  summary: string;
}

export interface GroupModel {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  barStart: number;
  barEnd: number;
  rows: RowModel[];
}

export interface GanttModel {
  scale: GanttScale;
  todayX: number;
  months: Tick[];
  weeks: Tick[];
  groups: GroupModel[];
  rowCount: number;
}

const STATE_TEXT: Record<StepState, string> = {
  DONE: "done",
  NEXT: "next",
  OVERDUE: "overdue",
  UPCOMING: "upcoming",
  WITHDRAWN: "withdrawn",
};

function buildScale(participations: Participation[], today: number, zoom: GanttZoom): GanttScale {
  let min = today;
  let max = today;
  const include = (day: number) => {
    if (Number.isNaN(day)) return;
    min = Math.min(min, day);
    max = Math.max(max, day);
  };
  participations.forEach((p) => {
    include(dayNumber(p.tournament.startDate));
    include(dayNumber(p.tournament.endDate));
    p.steps.forEach((s) => include(dayNumber(s.dueDate)));
  });
  const startDay = min - PAD_BEFORE_DAYS;
  const days = max - startDay + 1 + PAD_AFTER_DAYS;
  const pxPerDay = PX_PER_DAY[zoom];
  return { startDay, days, pxPerDay, width: days * pxPerDay, x: (day) => (day - startDay) * pxPerDay };
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function monthTicks(scale: GanttScale): Tick[] {
  const ticks: Tick[] = [];
  const first = fromDayNumber(scale.startDay);
  let year = Number(first.slice(0, 4));
  let month = Number(first.slice(5, 7));
  const end = scale.startDay + scale.days;
  for (;;) {
    const day = Date.UTC(year, month - 1, 1) / 86_400_000;
    if (day > end) break;
    const label = MONTH_LABEL.format(new Date(day * 86_400_000));
    // The partial first month is labelled at the left edge.
    if (day >= scale.startDay) ticks.push({ day, x: scale.x(day), label });
    else ticks.push({ day: scale.startDay, x: 0, label });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return ticks;
}

/** Mondays (1970-01-01 was a Thursday, so day 4 is a Monday). */
function weekTicks(scale: GanttScale): Tick[] {
  const ticks: Tick[] = [];
  const firstMonday = scale.startDay + ((((4 - scale.startDay) % 7) + 7) % 7);
  for (let day = firstMonday; day < scale.startDay + scale.days; day += 7) {
    ticks.push({ day, x: scale.x(day), label: String(Number(fromDayNumber(day).slice(8, 10))) });
  }
  return ticks;
}

function rowModel(p: Participation, scale: GanttScale, timeZone: string): RowModel {
  const half = scale.pxPerDay / 2;
  const label = `${p.team.name} — ${p.tournament.name}`;
  const markers = p.steps.map<MarkerModel>((step) => {
    const completedDay = step.completedAt ? dayOfInstant(step.completedAt, timeZone) : "";
    const completedX = completedDay ? scale.x(dayNumber(completedDay)) + half : null;
    const done = completedDay ? `, done ${formatDayShort(completedDay)}` : "";
    return {
      status: step.status,
      label: step.label,
      state: step.state,
      x: scale.x(dayNumber(step.dueDate)) + half,
      completedX,
      text: `${step.label} – due ${formatDayShort(step.dueDate)}${done} (${STATE_TEXT[step.state]})`,
    };
  });
  const due = p.nextStatus && p.nextDueDate ? `, next: ${statusLabel(p.nextStatus, p)} due ${formatDayShort(p.nextDueDate)}` : "";
  const emailDay = p.emails?.nextSendAt ? dayOfInstant(p.emails.nextSendAt, timeZone) : "";
  const nextEmail = emailDay ? { x: scale.x(dayNumber(emailDay)) + half, text: `next email ${formatDayShort(emailDay)}` } : null;
  return {
    participation: p,
    nextEmail,
    label,
    withdrawn: p.status === "WITHDRAWN",
    lineFrom: Math.min(...markers.map((m) => m.x)),
    barStart: scale.x(dayNumber(p.tournament.startDate)),
    barEnd: scale.x(dayNumber(p.tournament.endDate) + 1),
    markers,
    summary: `${label}: ${statusLabel(p.status, p)}${due}${p.overdue ? " (overdue)" : ""}${nextEmail ? `, ${nextEmail.text}` : ""}`,
  };
}

export function buildGanttModel(participations: Participation[], today: string, timeZone: string, zoom: GanttZoom): GanttModel {
  const todayDay = dayNumber(today);
  const scale = buildScale(participations, todayDay, zoom);
  const byTournament = new Map<string, GroupModel>();
  const sorted = [...participations].sort(
    (a, b) =>
      a.tournament.startDate.localeCompare(b.tournament.startDate) ||
      a.tournament.name.localeCompare(b.tournament.name) ||
      a.team.name.localeCompare(b.team.name),
  );
  sorted.forEach((p) => {
    let group = byTournament.get(p.tournament.id);
    if (!group) {
      group = {
        id: p.tournament.id,
        name: p.tournament.name,
        startDate: p.tournament.startDate,
        endDate: p.tournament.endDate,
        barStart: scale.x(dayNumber(p.tournament.startDate)),
        barEnd: scale.x(dayNumber(p.tournament.endDate) + 1),
        rows: [],
      };
      byTournament.set(p.tournament.id, group);
    }
    group.rows.push(rowModel(p, scale, timeZone));
  });
  return {
    scale,
    todayX: scale.x(todayDay) + scale.pxPerDay / 2,
    months: monthTicks(scale),
    weeks: weekTicks(scale),
    groups: [...byTournament.values()],
    rowCount: participations.length,
  };
}
