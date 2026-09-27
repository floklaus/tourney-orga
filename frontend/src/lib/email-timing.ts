// Email timing (api-contract v2.0): ABSOLUTE `sendAt`, or RELATIVE `offsetDays` + `timeOfDay`
// from the tournament START or END date, in the settings timezone. The server is authoritative;
// the helpers here only describe and estimate.

import { formatDateTimeWithZone, isoToLocalInput, localInputToIso } from "./dates";
import { addDays } from "./days";
import type { EmailTiming, TimingAnchor, TimingType } from "./email-types";

const TIME_OF_DAY = /^\d{2}:\d{2}$/;
const WHOLE_NUMBER = /^-?\d+$/;
export const DEFAULT_TIME_OF_DAY = "09:00";

/** Form state of the timing fields (strings as typed). */
export interface TimingValue {
  timingType: TimingType;
  sendAtLocal: string;
  offsetDays: string;
  timeOfDay: string;
  anchor: TimingAnchor;
}

export type TimingErrors = Partial<Record<keyof TimingValue, string>>;

export interface TournamentDates {
  startDate: string;
  endDate: string;
}

const ERRORS = {
  sendAt: "Choose a date and time.",
  offsetDays: "Enter a whole number of days.",
  timeOfDay: "Enter a time (HH:mm).",
};

export function toTimingValue(timing: EmailTiming | null | undefined, timeZone: string): TimingValue {
  return {
    timingType: timing?.timingType ?? "RELATIVE",
    sendAtLocal: isoToLocalInput(timing?.sendAt, timeZone),
    offsetDays: timing?.offsetDays !== null && timing?.offsetDays !== undefined ? String(timing.offsetDays) : "",
    timeOfDay: timing?.timeOfDay ?? DEFAULT_TIME_OF_DAY,
    anchor: timing?.anchor ?? "START",
  };
}

export function validateTiming(value: TimingValue): TimingErrors {
  const errors: TimingErrors = {};
  if (value.timingType === "ABSOLUTE") {
    if (!value.sendAtLocal) errors.sendAtLocal = ERRORS.sendAt;
    return errors;
  }
  if (!WHOLE_NUMBER.test(value.offsetDays.trim())) errors.offsetDays = ERRORS.offsetDays;
  if (!TIME_OF_DAY.test(value.timeOfDay)) errors.timeOfDay = ERRORS.timeOfDay;
  return errors;
}

/** Form value -> API timing (call after validateTiming passed). */
export function fromTimingValue(value: TimingValue, timeZone: string): EmailTiming {
  if (value.timingType === "ABSOLUTE") {
    return { timingType: "ABSOLUTE", sendAt: localInputToIso(value.sendAtLocal, timeZone), offsetDays: null, timeOfDay: null, anchor: value.anchor };
  }
  return {
    timingType: "RELATIVE",
    sendAt: null,
    offsetDays: Number.parseInt(value.offsetDays.trim(), 10),
    timeOfDay: value.timeOfDay,
    anchor: value.anchor,
  };
}

/** "21 days before start at 09:00", "On the end day at 18:00". */
export function describeRelative(offsetDays: number | null, timeOfDay: string | null, anchor: TimingAnchor): string {
  if (offsetDays === null || Number.isNaN(offsetDays)) return "—";
  const time = timeOfDay || "--:--";
  const anchorText = anchor === "END" ? "end" : "start";
  if (offsetDays === 0) return `On the ${anchorText} day at ${time}`;
  const days = Math.abs(offsetDays);
  return `${days} ${days === 1 ? "day" : "days"} ${offsetDays < 0 ? "before" : "after"} ${anchorText} at ${time}`;
}

/** Human text of a timing: the relative rule, or the fixed date and time. */
export function describeTiming(timing: EmailTiming, timeZone: string): string {
  if (timing.timingType === "ABSOLUTE") return formatDateTimeWithZone(timing.sendAt, timeZone);
  return describeRelative(timing.offsetDays, timing.timeOfDay, timing.anchor);
}

/** Client-side estimate of the send time for the given tournament dates (null if incomplete). */
export function estimateSendAt(timing: EmailTiming, dates: TournamentDates | null | undefined, timeZone: string): string | null {
  if (timing.timingType === "ABSOLUTE") return timing.sendAt;
  if (!dates || timing.offsetDays === null || !timing.timeOfDay || !TIME_OF_DAY.test(timing.timeOfDay)) return null;
  const day = addDays(timing.anchor === "END" ? dates.endDate : dates.startDate, timing.offsetDays);
  return day ? localInputToIso(`${day}T${timing.timeOfDay}`, timeZone) : null;
}

/** Sorts timings by their (estimated) send time; unknown times last, stable otherwise. */
export function sortByEstimate<T extends EmailTiming>(items: T[], dates: TournamentDates | null | undefined, timeZone: string): T[] {
  const time = (item: T) => {
    const iso = estimateSendAt(item, dates, timeZone);
    const ms = iso ? new Date(iso).getTime() : Number.NaN;
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  };
  return items
    .map((item, index) => ({ item, index, at: time(item) }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((entry) => entry.item);
}
