/**
 * Mirrors backend/src/modules/team/domain/age-group.ts: the age group is the
 * school grade + 6 (8th grade → U14), and the school year rolls over on the
 * 1st of the season start month. Dates are calendar dates (YYYY-MM-DD).
 */

export const MIN_GRADUATION_YEAR = 2000;
export const MAX_GRADUATION_YEAR = 2100;

const AGE_GROUP_PATTERN = /^(?:U\s*(\d{1,2})|(\d{1,2})\s*U)$/i;

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Calendar year in which the school year containing `date` ends. */
function schoolYearEnd(date: string, seasonStartMonth: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return seasonStartMonth > 1 && month >= seasonStartMonth ? year + 1 : year;
}

/** School grade (12 = senior year); above 12 once graduated. */
export function gradeFor(graduationYear: number, seasonStartMonth: number, date = localToday()): number {
  return 12 - (graduationYear - schoolYearEnd(date, seasonStartMonth));
}

export function ageGroupFor(graduationYear: number | null, seasonStartMonth: number, date = localToday()): string | null {
  return graduationYear === null ? null : `U${gradeFor(graduationYear, seasonStartMonth, date) + 6}`;
}

const ORDINAL: Record<string, string> = { "1": "st", "2": "nd", "3": "rd" };

/** "8th grade", "Kindergarten" or "Graduated" for the school year of `date`. */
export function gradeLabel(graduationYear: number, seasonStartMonth: number, date = localToday()): string {
  const grade = gradeFor(graduationYear, seasonStartMonth, date);
  if (grade > 12) return "Graduated";
  if (grade === 0) return "Kindergarten";
  if (grade < 0) return "Pre-school";
  const last = String(grade % 100 > 10 && grade % 100 < 14 ? 0 : grade % 10);
  return `${grade}${ORDINAL[last] ?? "th"} grade`;
}

/**
 * The tournament age group a team belongs in on `date`: a division named after
 * its graduation year, else the youngest "U<n>"/"<n>U" group with n ≥ its age.
 */
export function matchAgeGroup(graduationYear: number | null, seasonStartMonth: number, date: string, ageGroups: string[]): string | null {
  if (graduationYear === null) return null;
  const byYear = ageGroups.find((g) => g.trim() === String(graduationYear));
  if (byYear) return byYear;
  const age = gradeFor(graduationYear, seasonStartMonth, date) + 6;
  const eligible = ageGroups
    .map((group) => {
      const match = AGE_GROUP_PATTERN.exec(group.trim());
      return { group, limit: match ? Number(match[1] ?? match[2]) : NaN };
    })
    .filter((g) => g.limit >= age)
    .sort((a, b) => a.limit - b.limit);
  return eligible[0]?.group ?? null;
}
