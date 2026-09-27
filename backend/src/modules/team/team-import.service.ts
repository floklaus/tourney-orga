import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomToken } from '../../common/crypto';
import { GroupService } from './group.service';
import { parseTeamCsv, TeamCsvRow } from './team-csv';
import { Team } from './team.entity';
import { ImportTeamsDto } from './team.dto';

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class TeamImportService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly groups: GroupService,
  ) {}

  /** Validates everything first; writes only when there are no errors and dryRun is false. */
  async import(dto: ImportTeamsDto): Promise<ImportResult> {
    const { rows, errors } = parseTeamCsv(dto.csv);
    const existing = await this.dataSource
      .getRepository(Team)
      .find({ relations: { groups: true } });
    const byName = new Map(existing.map((t) => [t.name, t]));

    let created = 0;
    let updated = 0;
    for (const row of rows) {
      if (!byName.has(row.name)) created++;
      else if (dto.mode === 'upsert') updated++;
      else
        errors.push({
          row: row.row,
          message: `team "${row.name}" already exists`,
        });
    }
    const result = {
      created,
      updated,
      errors: errors.sort((a, b) => a.row - b.row),
    };
    if (dto.dryRun || errors.length > 0) return result;

    await this.dataSource.transaction(async (em) => {
      const groups = await this.groups.findOrCreateByNames(
        rows.flatMap((r) => r.groups),
      );
      const groupsFor = (row: TeamCsvRow) =>
        groups.filter((g) => row.groups.includes(g.name));
      const teams = rows.map((row) => {
        const current = byName.get(row.name);
        const fields = {
          name: row.name,
          contactName: row.contactName,
          email: row.email,
          ccEmails: row.ccEmails,
          ...(row.graduationYear !== undefined && {
            graduationYear: row.graduationYear,
          }),
        };
        return current
          ? {
              ...current,
              ...fields,
              groups: dedupe([...current.groups, ...groupsFor(row)]),
            }
          : em.create(Team, {
              ...fields,
              unsubscribeToken: randomToken(),
              groups: groupsFor(row),
            });
      });
      await em.save(Team, teams);
    });
    return result;
  }
}

const dedupe = <T extends { id: string }>(items: T[]) => [
  ...new Map(items.map((i) => [i.id, i])).values(),
];
