import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryModule } from '../delivery/delivery.module';
import { TemplateModule } from '../template/template.module';
import { Participation } from '../tournament/participation.entity';
import { EmailStepController } from './email-step.controller';
import { EmailStep } from './email-step.entity';
import { EmailStepService } from './email-step.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailStep, Participation]),
    TemplateModule,
    DeliveryModule,
  ],
  controllers: [EmailStepController],
  providers: [EmailStepService],
})
export class EmailModule {}
