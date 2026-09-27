import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupService } from './group.service';
import { TeamGroup } from './team-group.entity';
import { TeamImportService } from './team-import.service';
import { GroupController, TeamController } from './team.controller';
import { Team } from './team.entity';
import { TeamService } from './team.service';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamGroup])],
  controllers: [TeamController, GroupController],
  providers: [TeamService, GroupService, TeamImportService],
  exports: [TeamService, GroupService],
})
export class TeamModule {}
