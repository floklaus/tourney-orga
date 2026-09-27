import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { TournamentModule } from '../tournament/tournament.module';
import { AttentionController } from './attention.controller';
import { AttentionService } from './attention.service';

@Module({
  imports: [DeliveryModule, TournamentModule],
  controllers: [AttentionController],
  providers: [AttentionService],
})
export class AttentionModule {}
