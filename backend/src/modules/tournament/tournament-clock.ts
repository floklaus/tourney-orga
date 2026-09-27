import { DateTime } from 'luxon';

export type Timing = 'UPCOMING' | 'ONGOING' | 'PAST';

/** Today's calendar date (YYYY-MM-DD) in the organizer's timezone. */
export const todayIn = (timezone: string, now = new Date()): string =>
  DateTime.fromJSDate(now, { zone: timezone }).toISODate()!;

export function timingOf(
  dates: { startDate: string; endDate: string },
  today: string,
): Timing {
  if (dates.startDate > today) return 'UPCOMING';
  if (dates.endDate < today) return 'PAST';
  return 'ONGOING';
}
