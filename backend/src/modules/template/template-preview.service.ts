import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { notFound } from '../../common/errors';
import { Participation } from '../tournament/participation.entity';
import { Tournament } from '../tournament/tournament.entity';
import { effectiveVariables, hasValue } from '../email/variables';
import { MAIL_TRANSPORT, type MailTransport } from '../mail/mail-transport';
import { SystemMailService } from '../mail/system-mail.service';
import { SettingsService } from '../settings/settings.service';
import { Team } from '../team/team.entity';
import {
  EmailContext,
  EmailRendererService,
  RenderedEmail,
  SAMPLE_TEAM,
} from './email-renderer.service';
import { PreviewDto } from './template.dto';
import { assertValidPlaceholders } from './template.service';
import { tournamentDays } from '../tournament/domain/tournament-days';
import { findTournamentVars } from './domain/placeholders';

const SAMPLE_CONTEXT: EmailContext = {
  tournament: {
    name: 'Summer Cup',
    startDate: '2026-06-20',
    endDate: '2026-06-21',
    url: 'https://example.com/cup',
  },
  variables: { venue: 'Main Hall' },
  ageGroup: 'U12',
  days: ['2026-06-20', '2026-06-21'],
};

@Injectable()
export class TemplatePreviewService {
  constructor(
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Tournament)
    private readonly tournaments: Repository<Tournament>,
    @InjectRepository(Participation)
    private readonly participations: Repository<Participation>,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly renderer: EmailRendererService,
    private readonly settings: SettingsService,
    private readonly systemMail: SystemMailService,
  ) {}

  /** Renders with a real participation, a tournament, or sample data. */
  async render(
    dto: PreviewDto,
  ): Promise<RenderedEmail & { missingVariables: string[] }> {
    assertValidPlaceholders(dto.subject, dto.bodyHtml);
    const participation = dto.participationId
      ? await this.participations.findOne({
          where: { id: dto.participationId },
          relations: { tournament: true, team: true },
        })
      : null;
    if (dto.participationId && !participation) throw notFound('Participation');
    const tournament =
      participation?.tournament ??
      (dto.tournamentId
        ? await this.tournaments.findOneBy({ id: dto.tournamentId })
        : null);
    if (dto.tournamentId && !tournament) throw notFound('Tournament');
    const team =
      participation?.team ??
      (dto.teamId
        ? await this.teams.findOneBy({ id: dto.teamId })
        : SAMPLE_TEAM);
    if (!team) throw notFound('Team');
    const context: EmailContext = tournament
      ? {
          tournament,
          variables: effectiveVariables(
            tournament.variables,
            participation?.variables ?? {},
          ),
          ageGroup: participation?.ageGroup ?? null,
          days: participation?.days ?? tournamentDays(tournament),
        }
      : SAMPLE_CONTEXT;
    const email = this.renderer.render(
      dto,
      team,
      context,
      await this.settings.get(),
    );
    const missingVariables = findTournamentVars(
      `${dto.subject}\n${dto.bodyHtml}`,
    )
      .filter((key) => !hasValue(context.variables[key]))
      .sort();
    return { ...email, missingVariables };
  }

  async sendTest(to: string, dto: PreviewDto): Promise<void> {
    this.systemMail.assertAvailable();
    const email = await this.render(dto);
    await this.transport.send({
      from: await this.systemMail.fromHeader(),
      to,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
    });
  }
}
