import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { unprocessable } from '../../common/errors';
import { EnvironmentVariables } from '../../config/env.validation';
import { sanitizeBody } from '../template/domain/placeholders';
import { UpdateSettingsDto } from './settings.dto';
import { isMailConfigured } from '../mail/mail-transport';
import {
  DeliveryStatus,
  EmailDelivery,
} from '../delivery/email-delivery.entity';
import { SendingMode, Setting, SETTINGS_ID } from './setting.entity';
import type { MilestoneRule } from '../tournament/domain/participation-process';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting) private readonly repo: Repository<Setting>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  async get(): Promise<Setting> {
    const existing = await this.repo.findOneBy({ id: SETTINGS_ID });
    if (existing) return existing;
    await this.repo.upsert({ id: SETTINGS_ID }, ['id']);
    return this.repo.findOneByOrFail({ id: SETTINGS_ID });
  }

  get automaticSendingAvailable(): boolean {
    return isMailConfigured(this.env);
  }

  /** The mode actually in effect: always MANUAL when no mailbox is configured. */
  effectiveMode(setting: Setting): SendingMode {
    return this.automaticSendingAvailable
      ? setting.sendingMode
      : SendingMode.MANUAL;
  }

  async currentMode(): Promise<SendingMode> {
    return this.effectiveMode(await this.get());
  }

  /** Writes only the given fields, so a concurrent pause set by the scheduler is never overwritten. */
  async update(dto: UpdateSettingsDto): Promise<Setting> {
    await this.get();
    if (
      dto.sendingMode === SendingMode.AUTOMATIC &&
      !this.automaticSendingAvailable
    ) {
      throw unprocessable(
        'Automatic sending needs a mailbox configured on the server (MAIL_AUTH_MODE)',
      );
    }
    const changes: Partial<Setting> = { ...dto };
    if (dto.footerHtml) changes.footerHtml = sanitizeBody(dto.footerHtml);
    await this.dataSource.transaction(async (em) => {
      if (Object.keys(changes).length > 0)
        await em.update(Setting, { id: SETTINGS_ID }, changes);
      if (dto.sendingMode === SendingMode.MANUAL) {
        // Nothing may go out automatically anymore: hand queued emails over to manual sending.
        await em.update(
          EmailDelivery,
          { status: DeliveryStatus.QUEUED, lockedAt: IsNull() },
          { status: DeliveryStatus.READY },
        );
      }
    });
    return this.get();
  }

  async setParticipationDefaults(
    participationDefaults: MilestoneRule[],
  ): Promise<void> {
    await this.get();
    await this.repo.update({ id: SETTINGS_ID }, { participationDefaults });
  }

  async resumeSending(): Promise<void> {
    await this.get();
    await this.repo.update(
      { id: SETTINGS_ID },
      { pausedUntil: null, pauseReason: null },
    );
  }

  async pauseSending(until: Date, reason: string): Promise<void> {
    await this.get();
    await this.repo.update(
      { id: SETTINGS_ID },
      { pausedUntil: until, pauseReason: reason },
    );
  }

  toResponse(setting: Setting) {
    return {
      organizerName: setting.organizerName,
      senderName: setting.senderName,
      senderEmail: this.env.get('MAIL_USER', { infer: true }) ?? null,
      replyToEmail: setting.replyToEmail,
      timezone: setting.timezone,
      seasonStartMonth: setting.seasonStartMonth,
      footerHtml: setting.footerHtml,
      logoUrl: setting.logoUrl,
      ratePerMinute: setting.ratePerMinute,
      dailyRecipientCap: setting.dailyRecipientCap,
      authMode: this.env.get('MAIL_AUTH_MODE', { infer: true }),
      sendingMode: this.effectiveMode(setting),
      automaticSendingAvailable: this.automaticSendingAvailable,
    };
  }
}
