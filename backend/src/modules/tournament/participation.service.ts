import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  conflict,
  isUniqueViolation,
  notFound,
  unprocessable,
} from '../../common/errors';
import { createStepsFromPlan } from '../email/email-plan';
import { loadEmailData } from './participation-emails';
import { checkVariables } from '../email/variables';
import { SettingsService } from '../settings/settings.service';
import { matchAgeGroup } from '../team/domain/age-group';
import { Team } from '../team/team.entity';
import { User } from '../user/user.entity';
import {
  allowedTransitions,
  lastActiveStatus,
  ParticipationStatus,
  STATUS_LABELS,
  transitionPath,
} from './domain/participation-process';
import { ClockContext, historyForProgress } from './participation.mapper';
import {
  Participation,
  ParticipationStatusChange,
} from './participation.entity';
import { checkDays } from './domain/tournament-days';
import { todayIn } from './tournament-clock';
import { Tournament } from './tournament.entity';
import {
  BulkCreateParticipationDto,
  CreateParticipationDto,
  TransitionDto,
  UpdateParticipationDto,
} from './tournament.dto';

const RELATIONS = {
  tournament: true,
  team: true,
  history: { changedBy: true },
} as const;
const STALE =
  'This participation was changed in the meantime. Reload and try again.';

@Injectable()
export class ParticipationService {
  constructor(
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  emailData(participationIds: string[]) {
    return loadEmailData(this.dataSource, participationIds);
  }

  async clock(): Promise<ClockContext> {
    const { timezone, seasonStartMonth } = await this.settings.get();
    return { today: todayIn(timezone), timezone, seasonStartMonth };
  }

  findAll(tournamentIds?: string[]): Promise<Participation[]> {
    return this.participations.find({
      where: tournamentIds ? { tournament: { id: In(tournamentIds) } } : {},
      relations: RELATIONS,
    });
  }

  async findOne(id: string): Promise<Participation> {
    const participation = await this.participations.findOne({
      where: { id },
      relations: RELATIONS,
    });
    if (!participation) throw notFound('Participation');
    return participation;
  }

  async create(
    user: User,
    dto: CreateParticipationDto,
  ): Promise<Participation> {
    const tournament = await this.findTournament(dto.tournamentId);
    const team = await this.dataSource
      .getRepository(Team)
      .findOneBy({ id: dto.teamId });
    if (!team) throw notFound('Team');
    const ageGroup = checkAgeGroup(
      tournament,
      dto.ageGroup,
      await this.calculatedAgeGroup(tournament, team),
    );
    const days = checkDays(tournament, dto.days);
    try {
      const id = await this.dataSource.transaction((em) =>
        this.insert(em, user, tournament, team, {
          ageGroup,
          days,
          notes: dto.notes ?? null,
        }),
      );
      return this.findOne(id);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict(
          `${team.name} is already signed up for ${tournament.name}`,
        );
      throw error;
    }
  }

  async createMany(user: User, dto: BulkCreateParticipationDto) {
    const tournament = await this.findTournament(dto.tournamentId);
    // An explicit age group applies to all teams; otherwise each gets its calculated one
    const chosen = dto.ageGroup?.trim()
      ? checkAgeGroup(tournament, dto.ageGroup, null)
      : null;
    const days = checkDays(tournament, dto.days);
    const teams = await this.dataSource
      .getRepository(Team)
      .findBy({ id: In(dto.teamIds) });
    const existing = new Set(
      (
        await this.participations.find({
          where: { tournament: { id: tournament.id } },
        })
      ).map((p) => p.teamId),
    );
    const ageGroups = new Map<string, string | null>();
    for (const team of teams) {
      ageGroups.set(
        team.id,
        tournament.ageGroups.length === 0
          ? null
          : (chosen ?? (await this.calculatedAgeGroup(tournament, team))),
      );
    }
    const unmatched = teams.filter(
      (t) => tournament.ageGroups.length > 0 && !ageGroups.get(t.id),
    );
    const skipped = [
      ...dto.teamIds
        .filter((id) => !teams.some((t) => t.id === id))
        .map((teamId) => ({ teamId, reason: 'Team not found' })),
      ...teams
        .filter((t) => existing.has(t.id))
        .map((t) => ({ teamId: t.id, reason: 'Already signed up' })),
      ...unmatched
        .filter((t) => !existing.has(t.id))
        .map((t) => ({
          teamId: t.id,
          reason: 'No age group fits its graduation year: choose one',
        })),
    ];
    const toCreate = teams.filter(
      (t) => !existing.has(t.id) && !unmatched.includes(t),
    );
    const ids = await this.dataSource.transaction(async (em) => {
      const created: string[] = [];
      for (const team of toCreate) {
        created.push(
          await this.insert(em, user, tournament, team, {
            ageGroup: ageGroups.get(team.id) ?? null,
            days,
            notes: null,
          }),
        );
      }
      return created;
    });
    const created =
      ids.length > 0
        ? await this.participations.find({
            where: { id: In(ids) },
            relations: RELATIONS,
          })
        : [];
    return { created, skipped };
  }

  async update(
    id: string,
    dto: UpdateParticipationDto,
  ): Promise<Participation> {
    const participation = await this.findOne(id);
    if (participation.version !== dto.version) throw conflict(STALE);
    const changes: Partial<Participation> = {};
    if (dto.ageGroup !== undefined)
      changes.ageGroup = checkAgeGroup(
        participation.tournament,
        dto.ageGroup,
        await this.calculatedAgeGroup(
          participation.tournament,
          participation.team,
        ),
      );
    if (dto.days !== undefined)
      changes.days = checkDays(participation.tournament, dto.days);
    if (dto.notes !== undefined) changes.notes = dto.notes || null;
    if (dto.variables !== undefined)
      changes.variables = checkVariables(dto.variables);
    await this.conditionalUpdate(
      this.dataSource.manager,
      participation,
      changes,
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.participations.delete(id);
    if (!affected) throw notFound('Participation');
  }

  /** Applies one state-machine transition (see participation-process.ts), recording the history. */
  async transition(
    user: User,
    id: string,
    dto: Omit<TransitionDto, 'version'> & { version?: number },
  ): Promise<Participation> {
    const participation = await this.findOne(id);
    if (dto.version !== undefined && participation.version !== dto.version)
      throw conflict(STALE);
    const history = historyForProgress(participation.history);
    const allowed = allowedTransitions(
      participation.status,
      lastActiveStatus(history),
    );
    if (!allowed.includes(dto.to)) {
      throw conflictWithAllowed(participation.status, dto.to, allowed);
    }
    await this.dataSource.transaction(async (em) => {
      await this.conditionalUpdate(em, participation, {
        status: dto.to,
        withdrawnAt:
          dto.to === ParticipationStatus.WITHDRAWN ? new Date() : null,
      });
      let from: ParticipationStatus = participation.status;
      const base = Date.now();
      for (const [index, step] of transitionPath(
        participation.status,
        dto.to,
      ).entries()) {
        await em.insert(ParticipationStatusChange, {
          participation: { id },
          fromStatus: from,
          toStatus: step,
          note: dto.note ?? null,
          changedBy: { id: user.id },
          changedAt: new Date(base + index),
        });
        from = step;
      }
    });
    return this.findOne(id);
  }

  async transitionMany(
    user: User,
    ids: string[],
    to: ParticipationStatus,
    note: string | null,
  ) {
    const results: {
      id: string;
      ok: boolean;
      error?: string;
      participation?: Participation;
    }[] = [];
    for (const id of ids) {
      try {
        results.push({
          id,
          ok: true,
          participation: await this.transition(user, id, { to, note }),
        });
      } catch (error) {
        results.push({ id, ok: false, error: (error as Error).message });
      }
    }
    return results;
  }

  /** The tournament age group matching the team's graduation year at the tournament's start. */
  private async calculatedAgeGroup(
    tournament: Tournament,
    team: Team,
  ): Promise<string | null> {
    const { seasonStartMonth } = await this.clock();
    return matchAgeGroup(
      team.graduationYear,
      tournament.startDate,
      seasonStartMonth,
      tournament.ageGroups,
    );
  }

  private async insert(
    em: EntityManager,
    user: User,
    tournament: Tournament,
    team: Team,
    fields: Pick<Participation, 'ageGroup' | 'days' | 'notes'>,
  ): Promise<string> {
    const { identifiers } = await em.insert(Participation, {
      tournament,
      team,
      ...fields,
    });
    const id = identifiers[0].id as string;
    await createStepsFromPlan(
      em,
      { id },
      tournament,
      tournament.emailPlan,
      (await this.clock()).timezone,
      user,
    );
    await em.insert(ParticipationStatusChange, {
      participation: { id },
      fromStatus: null,
      toStatus: ParticipationStatus.SIGNED_UP,
      changedBy: { id: user.id },
      changedAt: new Date(),
    });
    return id;
  }

  /** Writes only if nobody changed the participation since it was loaded (version check). */
  private async conditionalUpdate(
    em: EntityManager,
    p: Participation,
    changes: Partial<Participation>,
  ): Promise<void> {
    const { affected } = await em
      .createQueryBuilder()
      .update(Participation)
      .set(changes)
      .where('id = :id AND version = :version', {
        id: p.id,
        version: p.version,
      })
      .execute();
    if (!affected) throw conflict(STALE);
  }

  private async findTournament(id: string): Promise<Tournament> {
    const tournament = await this.dataSource
      .getRepository(Tournament)
      .findOneBy({ id });
    if (!tournament) throw notFound('Tournament');
    return tournament;
  }
}

/**
 * Age group must be one of the tournament's (required when it has any).
 * Without one, the age group calculated from the team's graduation year is used.
 */
function checkAgeGroup(
  tournament: Tournament,
  ageGroup: string | null | undefined,
  calculated: string | null,
): string | null {
  const value = ageGroup?.trim() || calculated;
  if (tournament.ageGroups.length === 0) {
    if (value) throw unprocessable(`${tournament.name} has no age groups`);
    return null;
  }
  if (!value)
    throw unprocessable(
      `Choose an age group: ${tournament.ageGroups.join(', ')}`,
    );
  if (!tournament.ageGroups.includes(value)) {
    throw unprocessable(
      `"${value}" is not an age group of ${tournament.name}: ${tournament.ageGroups.join(', ')}`,
    );
  }
  return value;
}

function conflictWithAllowed(
  from: ParticipationStatus,
  to: ParticipationStatus,
  allowed: ParticipationStatus[],
) {
  return new ConflictException({
    message: `Cannot change from "${STATUS_LABELS[from]}" to "${STATUS_LABELS[to]}"`,
    details: { allowed },
  });
}
