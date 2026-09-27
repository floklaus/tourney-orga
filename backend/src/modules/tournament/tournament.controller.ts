import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators';
import { runListQuery } from '../../common/list/list-engine';
import { ListQueryDto } from '../../common/list/list-query.dto';
import { User } from '../user/user.entity';
import {
  PROCESS,
  ParticipationStatus,
  STATUS_LABELS,
  TERMINAL,
} from './domain/participation-process';
import {
  toParticipationResponse,
  toStatusChangeResponse,
  sortedHistory,
} from './participation.mapper';
import { ParticipationService } from './participation.service';
import {
  PARTICIPATION_LIST_SPEC,
  TOURNAMENT_LIST_SPEC,
} from './tournament.list-spec';
import { toTournamentResponse } from './tournament.mapper';
import { TournamentService } from './tournament.service';
import {
  BulkCreateParticipationDto,
  BulkTransitionDto,
  CreateParticipationDto,
  CreateTournamentDto,
  ForceQuery,
  ParticipationDefaultsDto,
  TransitionDto,
  UpdateParticipationDto,
  UpdateTournamentDto,
} from './tournament.dto';

@Controller('tournaments')
export class TournamentController {
  constructor(
    private readonly tournaments: TournamentService,
    private readonly participations: ParticipationService,
  ) {}

  @Get()
  async list(@Query() query: ListQueryDto) {
    const { today } = await this.participations.clock();
    const tournaments = await this.tournaments.findAll();
    const extras = await this.tournaments.extras(tournaments);
    const items = tournaments.map((t) =>
      toTournamentResponse(t, today, extras.get(t.id)),
    );
    return runListQuery(items, TOURNAMENT_LIST_SPEC, query);
  }

  @Post()
  async create(@Body() dto: CreateTournamentDto) {
    return this.respond(await this.tournaments.create(dto));
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return this.respond(await this.tournaments.findOne(id));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.respond(await this.tournaments.update(id, dto));
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ForceQuery,
  ) {
    await this.tournaments.remove(id, query.force === 'true');
    return null;
  }

  @Post(':id/email-plan/apply')
  @HttpCode(200)
  async applyPlan(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { added: await this.tournaments.applyEmailPlan(user, id) };
  }

  private async respond(
    tournament: Awaited<ReturnType<TournamentService['findOne']>>,
  ) {
    const extras = await this.tournaments.extras([tournament]);
    return toTournamentResponse(
      tournament,
      (await this.participations.clock()).today,
      extras.get(tournament.id),
    );
  }
}

@Controller('participation')
export class ParticipationProcessController {
  constructor(private readonly tournaments: TournamentService) {}

  @Get('statuses')
  statuses() {
    return [...PROCESS, ParticipationStatus.WITHDRAWN].map((status, order) => ({
      status,
      label: STATUS_LABELS[status],
      order,
      terminal: TERMINAL.includes(status),
    }));
  }

  @Get('defaults')
  async defaults() {
    return (await this.tournaments.defaults()).map((m) => ({
      ...m,
      label: STATUS_LABELS[m.status],
    }));
  }

  @Put('defaults')
  async saveDefaults(@Body() dto: ParticipationDefaultsDto) {
    return (await this.tournaments.saveDefaults(dto.milestones)).map((m) => ({
      ...m,
      label: STATUS_LABELS[m.status],
    }));
  }
}

@Controller('participations')
export class ParticipationController {
  constructor(private readonly participations: ParticipationService) {}

  @Get()
  async list(@Query() query: ListQueryDto) {
    const clock = await this.participations.clock();
    const participations = await this.participations.findAll();
    const emails = await this.participations.emailData(
      participations.map((p) => p.id),
    );
    const items = participations.map((p) =>
      toParticipationResponse(p, clock, emails.get(p.id)),
    );
    return runListQuery(items, PARTICIPATION_LIST_SPEC, query);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateParticipationDto) {
    return this.respond(await this.participations.create(user, dto));
  }

  @Post('bulk')
  async createMany(
    @CurrentUser() user: User,
    @Body() dto: BulkCreateParticipationDto,
  ) {
    const clock = await this.participations.clock();
    const { created, skipped } = await this.participations.createMany(
      user,
      dto,
    );
    const emails = await this.participations.emailData(
      created.map((p) => p.id),
    );
    return {
      created: created.map((p) =>
        toParticipationResponse(p, clock, emails.get(p.id)),
      ),
      skipped,
    };
  }

  @Post('transition')
  @HttpCode(200)
  async transitionMany(
    @CurrentUser() user: User,
    @Body() dto: BulkTransitionDto,
  ) {
    const clock = await this.participations.clock();
    const results = await this.participations.transitionMany(
      user,
      dto.ids,
      dto.to,
      dto.note ?? null,
    );
    return {
      results: results.map((r) => ({
        id: r.id,
        ok: r.ok,
        ...(r.error ? { error: r.error } : {}),
        ...(r.participation
          ? { participation: toParticipationResponse(r.participation, clock) }
          : {}),
      })),
    };
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const participation = await this.participations.findOne(id);
    return {
      ...(await this.respond(participation)),
      history: sortedHistory(participation.history).map(toStatusChangeResponse),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParticipationDto,
  ) {
    return this.respond(await this.participations.update(id, dto));
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.participations.remove(id);
    return null;
  }

  @Post(':id/transition')
  @HttpCode(200)
  async transition(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.respond(await this.participations.transition(user, id, dto));
  }

  private async respond(
    participation: Awaited<ReturnType<ParticipationService['findOne']>>,
  ) {
    const emails = await this.participations.emailData([participation.id]);
    return toParticipationResponse(
      participation,
      await this.participations.clock(),
      emails.get(participation.id),
    );
  }
}
