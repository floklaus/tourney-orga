import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailStep } from '../email/email-step.entity';
import { Team } from '../team/team.entity';
import { TeamModule } from '../team/team.module';
import { TemplateModule } from '../template/template.module';
import { DeliverySchedulerService } from './delivery-scheduler.service';
import { DeliverySenderService } from './delivery-sender.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { EmailDelivery } from './email-delivery.entity';
import { ManualDeliveryService } from './manual-delivery.service';
import { QuotaService } from './quota.service';
import { UnsubscribeController } from './unsubscribe.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailDelivery, EmailStep, Team]),
    TeamModule,
    TemplateModule,
  ],
  controllers: [DeliveryController, UnsubscribeController],
  providers: [
    ManualDeliveryService,
    DeliveryService,
    DeliverySchedulerService,
    DeliverySenderService,
    QuotaService,
  ],
  exports: [QuotaService, DeliveryService, DeliverySchedulerService],
})
export class DeliveryModule {}
