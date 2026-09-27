import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailStep } from '../email/email-step.entity';
import { Team } from '../team/team.entity';
import {
  Participation,
  ParticipationStatusChange,
} from './participation.entity';
import { ParticipationService } from './participation.service';
import {
  ParticipationController,
  ParticipationProcessController,
  TournamentController,
} from './tournament.controller';
import { Tournament } from './tournament.entity';
import { TournamentService } from './tournament.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tournament,
      Participation,
      ParticipationStatusChange,
      Team,
      EmailStep,
    ]),
  ],
  controllers: [
    TournamentController,
    ParticipationProcessController,
    ParticipationController,
  ],
  providers: [TournamentService, ParticipationService],
  exports: [TournamentService, ParticipationService],
})
export class TournamentModule {}
