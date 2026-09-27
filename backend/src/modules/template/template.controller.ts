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
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators';
import { runListQuery } from '../../common/list/list-engine';
import { ListQueryDto } from '../../common/list/list-query.dto';
import { ListSpec } from '../../common/list/list-spec';
import { findTournamentVars } from './domain/placeholders';
import { EmailTemplate } from './email-template.entity';
import { User } from '../user/user.entity';
import { PLACEHOLDERS } from './domain/placeholders';
import { TemplatePreviewService } from './template-preview.service';
import {
  CreateTemplateDto,
  PreviewDto,
  UpdateTemplateDto,
} from './template.dto';
import { TemplateService } from './template.service';

const TEMPLATE_LIST_SPEC: ListSpec<EmailTemplate> = {
  search: (t) => [t.name, t.subject],
  filters: [
    {
      key: 'variable',
      label: 'Tournament variable',
      type: 'tag',
      values: (t) =>
        findTournamentVars(`${t.subject}\n${t.bodyHtml}`).map((v) => ({
          value: v,
          label: v,
        })),
    },
  ],
  sorts: { name: (t) => t.name, updatedAt: (t) => t.updatedAt },
  defaultSort: 'name',
};

@Controller('templates')
export class TemplateController {
  constructor(
    private readonly templates: TemplateService,
    private readonly previews: TemplatePreviewService,
  ) {}

  @Get()
  async list(@Query() query: ListQueryDto) {
    return runListQuery(
      await this.templates.findAll(),
      TEMPLATE_LIST_SPEC,
      query,
    );
  }

  @Get('placeholders')
  placeholders() {
    return PLACEHOLDERS;
  }

  @Post('preview')
  @HttpCode(200)
  async preview(@Body() dto: PreviewDto) {
    const { subject, html, text, missingVariables } =
      await this.previews.render(dto);
    return {
      subject,
      html,
      text,
      ...(dto.tournamentId || dto.participationId ? { missingVariables } : {}),
    };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('test-send')
  @HttpCode(200)
  async testSend(@CurrentUser() user: User, @Body() dto: PreviewDto) {
    await this.previews.sendTest(user.email, dto);
    return null;
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templates.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.templates.remove(id);
    return null;
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.duplicate(id);
  }
}
