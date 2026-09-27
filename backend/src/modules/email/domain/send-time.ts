import { DateTime } from 'luxon';

export type TimingType = 'ABSOLUTE' | 'RELATIVE';
export type Anchor = 'START' | 'END';

export interface EmailTiming {
  timingType: TimingType;
  sendAt: Date | null;
  offsetDays: number | null;
  timeOfDay: string | null;
  anchor: Anchor;
}

export interface TournamentDates {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

/**
 * When an email is sent. Relative steps take the tournament's start or end date,
 * shift it by offsetDays and apply timeOfDay as local wall-clock time in `timezone`
 * (so DST changes are respected).
 */
export function resolveSendAt(
  step: EmailTiming,
  tournament: TournamentDates,
  timezone: string,
): Date | null {
  if (step.timingType === 'ABSOLUTE') return step.sendAt;
  if (step.offsetDays === null || !step.timeOfDay) return null;
  const [hour, minute] = step.timeOfDay.split(':').map(Number);
  const anchor =
    step.anchor === 'END' ? tournament.endDate : tournament.startDate;
  return DateTime.fromISO(anchor, { zone: timezone })
    .plus({ days: step.offsetDays })
    .set({ hour, minute, second: 0, millisecond: 0 })
    .toJSDate();
}

export function formatInZone(
  date: Date | string,
  timezone: string,
  locale = 'de-DE',
): string {
  const value =
    typeof date === 'string'
      ? DateTime.fromISO(date, { zone: timezone })
      : DateTime.fromJSDate(date, { zone: timezone });
  return value.setLocale(locale).toLocaleString(DateTime.DATE_MED);
}

export function isValidTimezone(timezone: string): boolean {
  return DateTime.local().setZone(timezone).isValid;
}
