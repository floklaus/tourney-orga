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
import { GroupService } from './group.service';
import { teamsToCsv } from './team-csv';
import { TeamImportService } from './team-import.service';
import {
  CreateGroupDto,
  CreateTeamDto,
  ImportTeamsDto,
  UpdateGroupDto,
  UpdateTeamDto,
} from './team.dto';
import { GROUP_LIST_SPEC, TEAM_LIST_SPEC } from './team.list-spec';
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

@Controller('groups')
export class GroupController {
  constructor(private readonly groups: GroupService) {}

  @Get()
  async list(@Query() query: ListQueryDto) {
    return runListQuery(await this.groups.findAll(), GROUP_LIST_SPEC, query);
  }

  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groups.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.groups.remove(id);
    return null;
  }
}
