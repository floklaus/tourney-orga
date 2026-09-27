import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { isEmail } from 'class-validator';
import {
  MAX_CC_EMAILS,
  MAX_GRADUATION_YEAR,
  MIN_GRADUATION_YEAR,
} from './team.dto';
import { Team } from './team.entity';

export const CSV_COLUMNS = [
  'name',
  'contactName',
  'email',
  'ccEmails',
  'graduationYear',
  'groups',
] as const;

export interface TeamCsvRow {
  row: number;
  name: string;
  contactName: string;
  email: string;
  ccEmails: string[];
  /** Undefined when the cell is empty: an import then keeps the team's current value. */
  graduationYear?: number;
  groups: string[];
}

export interface CsvParseResult {
  rows: TeamCsvRow[];
  errors: { row: number; message: string }[];
}

const splitList = (value: string | undefined) =>
  (value ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean);

/** Parses and validates import CSV. Row numbers are 1-based and include the header line. */
export function parseTeamCsv(csv: string): CsvParseResult {
  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (error) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Invalid CSV: ${(error as Error).message}` }],
    };
  }

  const result: CsvParseResult = { rows: [], errors: [] };
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const row = index + 2;
    const name = record.name ?? '';
    const email = (record.email ?? '').toLowerCase();
    const ccEmails = splitList(record.ccEmails).map((e) => e.toLowerCase());
    const graduationYear = record.graduationYear
      ? Number(record.graduationYear)
      : undefined;
    const problems = [
      !name && 'name is required',
      !record.contactName && 'contactName is required',
      !isEmail(email) && `invalid email "${email}"`,
      ccEmails.length > MAX_CC_EMAILS && `at most ${MAX_CC_EMAILS} CC emails`,
      ...ccEmails
        .filter((e) => !isEmail(e))
        .map((e) => `invalid CC email "${e}"`),
      graduationYear !== undefined &&
        !(
          Number.isInteger(graduationYear) &&
          graduationYear >= MIN_GRADUATION_YEAR &&
          graduationYear <= MAX_GRADUATION_YEAR
        ) &&
        `invalid graduationYear "${record.graduationYear}"`,
      seen.has(name) && `duplicate team name "${name}" in file`,
    ].filter((p): p is string => Boolean(p));
    seen.add(name);
    if (problems.length > 0) {
      result.errors.push({ row, message: problems.join('; ') });
      return;
    }
    result.rows.push({
      row,
      name,
      contactName: record.contactName,
      email,
      ccEmails,
      graduationYear,
      groups: splitList(record.groups),
    });
  });
  return result;
}

/** Prevents spreadsheet formula injection (cells starting with = + - @ tab or CR). */
const safeCell = (value: string) =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

export function teamsToCsv(teams: Team[]): string {
  return stringify(
    teams.map((t) => ({
      name: safeCell(t.name),
      contactName: safeCell(t.contactName),
      email: safeCell(t.email),
      ccEmails: safeCell(t.ccEmails.join(';')),
      graduationYear: t.graduationYear ?? '',
      groups: safeCell((t.groups ?? []).map((g) => g.name).join(';')),
    })),
    { header: true, columns: [...CSV_COLUMNS] },
  );
}
