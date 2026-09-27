import { DateTime } from 'luxon';
import { unprocessable } from '../../../common/errors';

/** Longest tournament we accept, in days. */
export const MAX_TOURNAMENT_DAYS = 60;

/** Calendar dates (YYYY-MM-DD) of a tournament. */
export interface TournamentDates {
  startDate: string;
  endDate: string;
}

const addDays = (date: string, days: number) =>
  DateTime.fromISO(date, { zone: 'utc' }).plus({ days }).toISODate()!;

const daysBetween = (from: string, to: string) =>
  DateTime.fromISO(to, { zone: 'utc' })
    .diff(DateTime.fromISO(from, { zone: 'utc' }), 'days')
    .as('days');

/** Number of days from start to end date, inclusive. */
export const dayCount = (dates: TournamentDates) =>
  daysBetween(dates.startDate, dates.endDate) + 1;

/** Every day from start to end date, inclusive. */
export function tournamentDays(dates: TournamentDates): string[] {
  const count = Math.min(dayCount(dates), MAX_TOURNAMENT_DAYS);
  return Array.from({ length: Math.max(count, 0) }, (_, i) =>
    addDays(dates.startDate, i),
  );
}

/** The days a team plays: sorted, unique, at least one, all within the tournament. Default: all days. */
export function checkDays(
  dates: TournamentDates,
  days: string[] | undefined,
): string[] {
  const all = tournamentDays(dates);
  if (days === undefined) return all;
  const unique = [...new Set(days)].sort();
  if (unique.length === 0) throw unprocessable('Choose at least one day');
  const outside = unique.find((d) => !all.includes(d));
  if (outside)
    throw unprocessable(
      `${outside} is not a day of the tournament (${dates.startDate} – ${dates.endDate})`,
    );
  return unique;
}

/**
 * Moves the days along with the tournament: each keeps its position
 * (1st day, 2nd day, …). Days beyond the new end are dropped; if none are left,
 * the team gets all days.
 */
export function shiftDays(
  days: string[],
  from: TournamentDates,
  to: TournamentDates,
): string[] {
  const all = tournamentDays(to);
  const shifted = days
    .map((d) => addDays(to.startDate, daysBetween(from.startDate, d)))
    .filter((d) => all.includes(d));
  return shifted.length > 0 ? [...new Set(shifted)].sort() : all;
}
