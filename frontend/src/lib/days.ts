// Helpers for calendar dates without time ("YYYY-MM-DD"), computed in UTC so no timezone can shift them.

const LOCALE = "en-GB";
export const DAY_MS = 86_400_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** Days since 1970-01-01 for a "YYYY-MM-DD" string (NaN if invalid). */
export function dayNumber(ymd: string): number {
  const match = YMD.exec(ymd);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
}

export function fromDayNumber(day: number): string {
  const date = new Date(day * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(ymd: string, days: number): string {
  const day = dayNumber(ymd);
  return Number.isNaN(day) ? "" : fromDayNumber(day + days);
}

export function isValidDay(ymd: string): boolean {
  return !Number.isNaN(dayNumber(ymd));
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone?: string): Intl.DateTimeFormat {
  const key = timeZone || "";
  let formatter = dayFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(key, formatter);
  }
  return formatter;
}

/** Calendar date of the instant `nowMs` in `timeZone`. */
export function todayIn(nowMs: number, timeZone?: string): string {
  const parts = dayFormatter(timeZone).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function format(ymd: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  if (!ymd) return "—";
  const day = dayNumber(ymd);
  if (Number.isNaN(day)) return "—";
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(new Date(day * DAY_MS));
}

/** "12 Mar 2026" */
export const formatDay = (ymd: string | null | undefined) => format(ymd, { day: "numeric", month: "short", year: "numeric" });

/** "12 Mar" */
export const formatDayShort = (ymd: string | null | undefined) => format(ymd, { day: "numeric", month: "short" });

/** "12–14 Mar 2026", "30 Mar – 2 Apr 2026" or a single day. */
export function formatDayRange(start: string, end: string): string {
  if (!end || start === end) return formatDay(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  if (sameMonth) return `${Number(start.slice(8, 10))}–${formatDay(end)}`;
  return `${sameYear ? formatDayShort(start) : formatDay(start)} – ${formatDay(end)}`;
}

/** Calendar date of an ISO timestamp in `timeZone`. */
export function dayOfInstant(iso: string, timeZone?: string): string {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? "" : todayIn(ms, timeZone);
}

/** "Sat 12 Jun" */
export const formatWeekday = (ymd: string | null | undefined) => format(ymd, { weekday: "short", day: "numeric", month: "short" });

/** Every day from start to end, inclusive. */
export function daysBetween(startDate: string, endDate: string): string[] {
  const start = dayNumber(startDate);
  const end = dayNumber(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => fromDayNumber(start + i));
}

/** "All days", or the chosen days as "Sat 12 Jun, Sun 13 Jun". */
export function formatPlayDays(days: string[], startDate: string, endDate: string): string {
  const all = daysBetween(startDate, endDate);
  if (all.length > 1 && all.every((d) => days.includes(d))) return "All days";
  return days.map(formatWeekday).join(", ");
}
