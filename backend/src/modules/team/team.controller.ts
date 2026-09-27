import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { runListQuery } from '../../common/list/list-engine';
import { ListQueryDto } from '../../common/list/list-query.dto';
import { teamsToCsv } from './team-csv';
import { TeamImportService } from './team-import.service';
import { CreateTeamDto, ImportTeamsDto, UpdateTeamDto } from './team.dto';
import { TEAM_LIST_SPEC } from './team.list-spec';
import { toTeamResponse } from './team.mapper';
import { TeamService } from './team.service';

@Controller('teams')
export class TeamController {
  constructor(
    private readonly teams: TeamService,
    private readonly importer: TeamImportService,
  ) {}

  @Get()
  async list(@Query() query: ListQueryDto) {
    const [teams, tournaments, season] = await Promise.all([
      this.teams.findAll(),
      this.teams.tournamentsByTeam(),
      this.teams.seasonClock(),
    ]);
    const items = teams.map((t) => ({
      ...toTeamResponse(t, season),
      tournaments: tournaments.get(t.id) ?? [],
    }));
    return runListQuery(items, TEAM_LIST_SPEC, query);
  }

  @Get('export')
  async export(@Res() res: Response) {
    const csv = teamsToCsv(await this.teams.findAllForExport());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="teams.csv"');
    res.send(csv);
  }

  @Post('import')
  import(@Body() dto: ImportTeamsDto) {
    return this.importer.import(dto);
  }

  @Post()
  async create(@Body() dto: CreateTeamDto) {
    return toTeamResponse(
      await this.teams.create(dto),
      await this.teams.seasonClock(),
    );
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return toTeamResponse(
      await this.teams.findOne(id),
      await this.teams.seasonClock(),
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return toTeamResponse(
      await this.teams.update(id, dto),
      await this.teams.seasonClock(),
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.teams.remove(id);
    return null;
  }

  @Post(':id/resubscribe')
  async resubscribe(@Param('id', ParseUUIDPipe) id: string) {
    const team = await this.teams.findOne(id);
    return toTeamResponse(
      await this.teams.setUnsubscribed(team, false),
      await this.teams.seasonClock(),
    );
  }
}
