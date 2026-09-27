import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailStep } from '../email/email-step.entity';
import { Participation } from '../tournament/participation.entity';
import { Tournament } from '../tournament/tournament.entity';
import { Team } from '../team/team.entity';
import { EmailRendererService } from './email-renderer.service';
import { EmailTemplate } from './email-template.entity';
import { TemplatePreviewService } from './template-preview.service';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailTemplate,
      EmailStep,
      Team,
      Tournament,
      Participation,
    ]),
  ],
  controllers: [TemplateController],
  providers: [TemplateService, TemplatePreviewService, EmailRendererService],
  exports: [TemplateService, EmailRendererService],
})
export class TemplateModule {}
