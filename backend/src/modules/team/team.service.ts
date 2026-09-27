import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomToken } from '../../common/crypto';
import { conflict, isUniqueViolation, notFound } from '../../common/errors';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../delivery/email-delivery.entity';
import { SettingsService } from '../settings/settings.service';
import { todayIn } from '../tournament/tournament-clock';
import { SeasonClock } from './domain/age-group';
import { Team } from './team.entity';
import { CreateTeamDto, UpdateTeamDto } from './team.dto';

const ANONYMIZED = 'deleted';

@Injectable()
export class TeamService {
  constructor(
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  async seasonClock(): Promise<SeasonClock> {
    const { timezone, seasonStartMonth } = await this.settings.get();
    return { today: todayIn(timezone), seasonStartMonth };
  }

  findAll(): Promise<Team[]> {
    return this.teams.find();
  }

  /** Tournaments each team participates in (not withdrawn), for list filtering. */
  async tournamentsByTeam(): Promise<
    Map<string, { id: string; name: string }[]>
  > {
    const rows: { team_id: string; id: string; name: string }[] =
      await this.dataSource.query(
        `SELECT p.team_id, t.id, t.name FROM participations p JOIN tournaments t ON t.id = p.tournament_id
        WHERE p.status <> 'WITHDRAWN'`,
      );
    const result = new Map<string, { id: string; name: string }[]>();
    for (const r of rows)
      result.set(r.team_id, [
        ...(result.get(r.team_id) ?? []),
        { id: r.id, name: r.name },
      ]);
    return result;
  }

  findAllForExport(): Promise<Team[]> {
    return this.teams.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teams.findOneBy({ id });
    if (!team) throw notFound('Team');
    return team;
  }

  findByName(name: string): Promise<Team | null> {
    return this.teams.findOneBy({ name });
  }

  findByUnsubscribeToken(unsubscribeToken: string): Promise<Team | null> {
    return this.teams.findOneBy({ unsubscribeToken });
  }

  async create(dto: CreateTeamDto): Promise<Team> {
    const team = this.teams.create({
      name: dto.name,
      contactName: dto.contactName,
      email: dto.email,
      ccEmails: dto.ccEmails ?? [],
      graduationYear: dto.graduationYear ?? null,
      notes: dto.notes ?? null,
      unsubscribeToken: randomToken(),
    });
    return this.findOne((await this.saveUnique(team)).id);
  }

  async update(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);
    await this.saveUnique({ ...team, ...dto });
    return this.findOne(id);
  }

  /** Deletes the team and anonymizes its past deliveries (GDPR). */
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.dataSource.transaction(async (em) => {
      // Pending emails to this team can never be sent now; skip them so their steps can finish.
      await em
        .createQueryBuilder()
        .update(EmailDelivery)
        .set({ status: DeliveryStatus.SKIPPED, skipReason: 'team deleted' })
        .where('team_id = :id AND status IN (:...pending)', {
          id,
          pending: [DeliveryStatus.QUEUED, DeliveryStatus.READY],
        })
        .execute();
      await em
        .createQueryBuilder()
        .update(EmailDelivery)
        .set({
          toEmail: ANONYMIZED,
          ccEmails: [],
          renderedSubject: '',
          renderedBodyHtml: '',
          lastError: null,
        })
        .where('team_id = :id', { id })
        .execute();
      // Delete participations first (their steps and deliveries cascade), so the team
      // delete does not depend on the order Postgres fires its cascade triggers in.
      await em.query(`DELETE FROM participations WHERE team_id = $1`, [id]);
      await em.delete(Team, id);
    });
  }

  async setUnsubscribed(team: Team, unsubscribed: boolean): Promise<Team> {
    const unsubscribedAt = unsubscribed
      ? (team.unsubscribedAt ?? new Date())
      : null;
    await this.teams.update(team.id, { unsubscribedAt });
    return { ...team, unsubscribedAt };
  }

  async saveUnique(team: Team): Promise<Team> {
    try {
      return await this.teams.save(team);
    } catch (error) {
      if (isUniqueViolation(error))
        throw conflict('A team with this name already exists');
      throw error;
    }
  }
}
