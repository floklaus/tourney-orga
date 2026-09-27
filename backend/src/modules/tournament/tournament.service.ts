import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EmailTemplate } from '../template/email-template.entity';
import {
  loadEmailData,
  tournamentVariableSummary,
} from './participation-emails';
import { TournamentExtras } from './tournament.mapper';
import { conflict, notFound, unprocessable } from '../../common/errors';
import {
  createStepsFromPlan,
  EmailPlanInput,
  normalizeEmailPlan,
  rescheduleTournamentSteps,
} from '../email/email-plan';
import { checkVariables } from '../email/variables';
import { User } from '../user/user.entity';
import { ParticipationStatus } from './domain/participation-process';
import { Participation } from './participation.entity';
import { SettingsService } from '../settings/settings.service';
import {
  DEFAULT_MILESTONES,
  MilestoneRule,
  milestoneOrderProblems,
  PROCESS,
  STATUS_LABELS,
} from './domain/participation-process';
import { Tournament } from './tournament.entity';
import { CreateTournamentDto, UpdateTournamentDto } from './tournament.dto';
import {
  dayCount,
  MAX_TOURNAMENT_DAYS,
  shiftDays,
} from './domain/tournament-days';

@Injectable()
export class TournamentService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  findAll(): Promise<Tournament[]> {
    return this.tournaments.find({
      relations: { participations: true },
      order: { startDate: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.tournaments.findOne({
      where: { id },
      relations: { participations: true },
    });
    if (!tournament) throw notFound('Tournament');
    return tournament;
  }

  async defaults(): Promise<MilestoneRule[]> {
    return (
      (await this.settings.get()).participationDefaults ?? DEFAULT_MILESTONES
    );
  }

  async saveDefaults(milestones: MilestoneRule[]): Promise<MilestoneRule[]> {
    const normalized = normalizeMilestones(milestones);
    await this.settings.setParticipationDefaults(normalized);
    return normalized;
  }

  async create(dto: CreateTournamentDto): Promise<Tournament> {
    const tournament = this.tournaments.create({
      name: dto.name.trim(),
      url: dto.url || null,
      startDate: dto.startDate,
      endDate: dto.endDate,
      description: dto.description ?? null,
      ageGroups: normalizeAgeGroups(dto.ageGroups ?? []),
      milestones: dto.milestones
        ? normalizeMilestones(dto.milestones)
        : await this.defaults(),
      variables: checkVariables(dto.variables),
      emailPlan: await normalizeEmailPlan(
        this.dataSource.manager,
        (dto.emailPlan ?? []) as EmailPlanInput[],
      ),
    });
    assertValidTournament(tournament);
    return this.findOne((await this.tournaments.save(tournament)).id);
  }

  async update(id: string, dto: UpdateTournamentDto): Promise<Tournament> {
    const current = await this.findOne(id);
    const next: Tournament = {
      ...current,
      name: dto.name?.trim() ?? current.name,
      url: dto.url === undefined ? current.url : dto.url || null,
      startDate: dto.startDate ?? current.startDate,
      endDate: dto.endDate ?? current.endDate,
      description:
        dto.description === undefined ? current.description : dto.description,
      ageGroups: dto.ageGroups
        ? normalizeAgeGroups(dto.ageGroups)
        : current.ageGroups,
      milestones: dto.milestones
        ? normalizeMilestones(dto.milestones)
        : current.milestones,
      variables:
        dto.variables === undefined
          ? current.variables
          : checkVariables(dto.variables),
      emailPlan:
        dto.emailPlan === undefined
          ? current.emailPlan
          : await normalizeEmailPlan(
              this.dataSource.manager,
              dto.emailPlan as EmailPlanInput[],
            ),
    };
    assertValidTournament(next);
    const removedAgeGroups = current.ageGroups.filter(
      (g) => !next.ageGroups.includes(g),
    );
    if (
      removedAgeGroups.length > 0 &&
      current.participations.some(
        (p) => p.ageGroup && removedAgeGroups.includes(p.ageGroup),
      )
    ) {
      throw conflict(
        `Age group(s) still used by participations: ${removedAgeGroups.join(', ')}`,
      );
    }
    await this.dataSource.transaction(async (em) => {
      await em.update(Tournament, id, {
        name: next.name,
        url: next.url,
        startDate: next.startDate,
        endDate: next.endDate,
        description: next.description,
        ageGroups: next.ageGroups,
        milestones: next.milestones,
        variables: next.variables,
        emailPlan: next.emailPlan,
      });
      if (
        next.startDate !== current.startDate ||
        next.endDate !== current.endDate
      ) {
        await rescheduleTournamentSteps(
          em,
          next,
          (await this.settings.get()).timezone,
        );
        for (const p of current.participations) {
          await em.update(Participation, p.id, {
            days: shiftDays(p.days, current, next),
          });
        }
      }
    });
    return this.findOne(id);
  }

  async remove(id: string, force: boolean): Promise<void> {
    const tournament = await this.findOne(id);
    if (tournament.participations.length > 0 && !force) {
      throw conflict(
        `The tournament has ${tournament.participations.length} participation(s). Delete with force to remove them too.`,
      );
    }
    await this.tournaments.delete(id);
  }

  /** Plan template names and variable summaries for tournament responses. */
  async extras(
    tournaments: Tournament[],
  ): Promise<Map<string, TournamentExtras>> {
    const participations = tournaments.flatMap((t) =>
      (t.participations ?? []).map((p) => ({ ...p, tournament: t })),
    );
    const emailData = await loadEmailData(
      this.dataSource,
      participations.map((p) => p.id),
    );
    const templateIds = [
      ...new Set(
        tournaments.flatMap((t) => t.emailPlan.map((i) => i.templateId)),
      ),
    ];
    const templates = templateIds.length
      ? await this.dataSource
          .getRepository(EmailTemplate)
          .findBy({ id: In(templateIds) })
      : [];
    const planTemplates = new Map(templates.map((t) => [t.id, t]));
    return new Map(
      tournaments.map((t) => [
        t.id,
        {
          planTemplates,
          variables: tournamentVariableSummary(
            t,
            participations.filter((p) => p.tournament.id === t.id),
            emailData,
            planTemplates,
          ),
        },
      ]),
    );
  }

  /** Adds the plan's emails to every non-withdrawn participation that does not have them yet. */
  async applyEmailPlan(user: User, id: string): Promise<number> {
    const tournament = await this.findOne(id);
    const { timezone } = await this.settings.get();
    return this.dataSource.transaction(async (em) => {
      const participations = await em.find(Participation, {
        where: { tournament: { id } },
      });
      let added = 0;
      for (const p of participations.filter(
        (x) => x.status !== ParticipationStatus.WITHDRAWN,
      )) {
        added += await createStepsFromPlan(
          em,
          p,
          tournament,
          tournament.emailPlan,
          timezone,
          user,
        );
      }
      return added;
    });
  }
}

function normalizeAgeGroups(groups: string[]): string[] {
  return [...new Set(groups.map((g) => g.trim()).filter(Boolean))];
}

/** Requires each of the 8 steps exactly once; returns them in process order. */
export function normalizeMilestones(
  milestones: MilestoneRule[],
): MilestoneRule[] {
  const byStatus = new Map(milestones.map((m) => [m.status, m]));
  const missing = PROCESS.filter((s) => !byStatus.has(s));
  if (missing.length > 0 || milestones.length !== PROCESS.length) {
    throw unprocessable(
      `Define each step exactly once. Missing: ${missing.map((s) => STATUS_LABELS[s]).join(', ') || 'none'}`,
      {
        missing,
      },
    );
  }
  return PROCESS.map((status) => {
    const { offsetDays, anchor } = byStatus.get(status)!;
    return { status, offsetDays, anchor };
  });
}

function assertValidTournament(
  t: Pick<Tournament, 'startDate' | 'endDate' | 'milestones'>,
): void {
  if (t.endDate < t.startDate)
    throw unprocessable('The end date must not be before the start date');
  if (dayCount(t) > MAX_TOURNAMENT_DAYS)
    throw unprocessable(
      `A tournament can last at most ${MAX_TOURNAMENT_DAYS} days`,
    );
  const problems = milestoneOrderProblems(t.milestones, t);
  if (problems.length > 0) {
    throw unprocessable(
      `Steps must be due in process order. Too early: ${problems.map((s) => STATUS_LABELS[s]).join(', ')}`,
      { steps: problems },
    );
  }
}
