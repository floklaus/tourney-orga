/**
 * Age groups follow school grades: a team's age group is its grade + 6
 * (8th grade → U14), and the grade comes from the graduation year and the
 * school year of a given date. The school year (and with it the age group)
 * rolls over on the 1st of the season start month.
 */

/** The date age groups are calculated for, and when the school year rolls over. */
export interface SeasonClock {
  today: string;
  seasonStartMonth: number;
}

const GRADUATION_GRADE = 12;
const GRADE_TO_AGE = 6;
const AGE_GROUP_PATTERN = /^(?:U\s*(\d{1,2})|(\d{1,2})\s*U)$/i;

/** Calendar year in which the school year containing `date` (YYYY-MM-DD) ends. */
export function schoolYearEnd(date: string, seasonStartMonth: number): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return seasonStartMonth > 1 && month >= seasonStartMonth ? year + 1 : year;
}

function ageOf(
  graduationYear: number,
  date: string,
  seasonStartMonth: number,
): number {
  const grade =
    GRADUATION_GRADE - (graduationYear - schoolYearEnd(date, seasonStartMonth));
  return grade + GRADE_TO_AGE;
}

/** "U14" for a class-of-2030 team during school year 2025/26; null without a graduation year. */
export function ageGroupFor(
  graduationYear: number | null,
  date: string,
  seasonStartMonth: number,
): string | null {
  return graduationYear === null
    ? null
    : `U${ageOf(graduationYear, date, seasonStartMonth)}`;
}

/**
 * The tournament age group a team belongs in: a division named after its
 * graduation year, else the youngest "U<n>"/"<n>U" group with n ≥ its age.
 */
export function matchAgeGroup(
  graduationYear: number | null,
  date: string,
  seasonStartMonth: number,
  ageGroups: string[],
): string | null {
  if (graduationYear === null) return null;
  const byYear = ageGroups.find((g) => g.trim() === String(graduationYear));
  if (byYear) return byYear;
  const age = ageOf(graduationYear, date, seasonStartMonth);
  const eligible = ageGroups
    .map((group) => {
      const match = AGE_GROUP_PATTERN.exec(group.trim());
      return { group, limit: match ? Number(match[1] ?? match[2]) : NaN };
    })
    .filter((g) => g.limit >= age)
    .sort((a, b) => a.limit - b.limit);
  return eligible[0]?.group ?? null;
}
