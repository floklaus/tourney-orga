import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';
import { CurrentUser } from '../../common/decorators';
import { runListQuery } from '../../common/list/list-engine';
import { ListQueryDto } from '../../common/list/list-query.dto';
import { ListSpec } from '../../common/list/list-spec';
import { SettingsService } from '../settings/settings.service';
import { User } from '../user/user.entity';
import { DeliverySchedulerService } from './delivery-scheduler.service';
import { DeliveryService, toDeliveryResponse } from './delivery.service';
import { DeliveryStatus } from './email-delivery.entity';
import { ManualDeliveryService } from './manual-delivery.service';
import { QuotaService } from './quota.service';

type DeliveryItem = ReturnType<typeof toDeliveryResponse>;

const DELIVERY_LIST_SPEC: ListSpec<DeliveryItem> = {
  search: (d) => [d.team?.name, d.toEmail, d.step?.name],
  filters: [
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      options: Object.values(DeliveryStatus).map((s) => ({
        value: s,
        label: s.charAt(0) + s.slice(1).toLowerCase(),
      })),
      values: (d) => [d.status],
    },
    {
      key: 'tournament',
      label: 'Tournament',
      type: 'ref',
      values: (d) =>
        d.tournament
          ? [{ value: d.tournament.id, label: d.tournament.name }]
          : [],
    },
    {
      key: 'team',
      label: 'Team',
      type: 'ref',
      values: (d) => (d.team ? [{ value: d.team.id, label: d.team.name }] : []),
    },
    {
      key: 'step',
      label: 'Email',
      type: 'tag',
      values: (d) =>
        d.step ? [{ value: d.step.name, label: d.step.name }] : [],
    },
    {
      key: 'sentManually',
      label: 'Sent manually',
      type: 'boolean',
      values: (d) => [d.sentManually],
    },
  ],
  sorts: {
    createdAt: (d) => d.createdAt,
    sentAt: (d) => d.sentAt,
    team: (d) => d.team?.name ?? d.toEmail,
    tournament: (d) => d.tournament?.name,
    status: (d) => d.status,
  },
  defaultSort: '-createdAt',
};

class BulkDeliveryDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsIn(['dismiss', 'resend'])
  action: 'dismiss' | 'resend';
}

@Controller()
export class DeliveryController {
  constructor(
    private readonly deliveries: DeliveryService,
    private readonly quota: QuotaService,
    private readonly scheduler: DeliverySchedulerService,
    private readonly settings: SettingsService,
    private readonly manual: ManualDeliveryService,
  ) {}

  @Get('deliveries')
  async listAll(@Query() query: ListQueryDto) {
    return runListQuery(
      (await this.deliveries.findAll()).map(toDeliveryResponse),
      DELIVERY_LIST_SPEC,
      query,
    );
  }

  @Post('deliveries/bulk')
  @HttpCode(200)
  async bulk(@CurrentUser() user: User, @Body() dto: BulkDeliveryDto) {
    const results = await this.deliveries.bulk(user, dto.ids, dto.action);
    if (dto.action === 'resend') this.scheduler.triggerSoon();
    return { results };
  }

  @Get('steps/:id/deliveries')
  async list(
    @Param('id', ParseUUIDPipe) stepId: string,
    @Query() query: ListQueryDto,
  ) {
    const items = (await this.deliveries.findByStep(stepId)).map(
      toDeliveryResponse,
    );
    return runListQuery(items, DELIVERY_LIST_SPEC, query);
  }

  @Post('deliveries/:id/resend')
  @HttpCode(200)
  async resend(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const delivery = await this.deliveries.resend(user, id);
    this.scheduler.triggerSoon();
    return toDeliveryResponse(delivery);
  }

  @Get('deliveries/:id/message')
  message(@Param('id', ParseUUIDPipe) id: string) {
    return this.manual.message(id);
  }

  @Post('deliveries/:id/mark-sent')
  @HttpCode(200)
  async markSent(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toDeliveryResponse(await this.manual.markSent(user, id));
  }

  @Post('deliveries/:id/mark-unsent')
  @HttpCode(200)
  async markUnsent(@Param('id', ParseUUIDPipe) id: string) {
    return toDeliveryResponse(await this.manual.markUnsent(id));
  }

  @Post('steps/:id/mark-all-sent')
  @HttpCode(200)
  async markAllSent(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) stepId: string,
  ) {
    return { marked: await this.manual.markAllSent(user, stepId) };
  }

  @Post('deliveries/resume')
  @HttpCode(200)
  async resume() {
    await this.settings.resumeSending();
    this.scheduler.triggerSoon();
    return this.quota.current();
  }

  @Get('deliveries/quota')
  current() {
    return this.quota.current();
  }
}
