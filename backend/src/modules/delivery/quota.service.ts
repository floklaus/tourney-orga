import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from '../settings/settings.service';
import { DeliveryStatus, EmailDelivery } from './email-delivery.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export interface Quota {
  used: number;
  cap: number;
  remaining: number;
  pausedUntil: Date | null;
  pauseReason: string | null;
}

/** Tracks Gmail usage in a rolling 24 h window (DLV-8). */
@Injectable()
export class QuotaService {
  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    private readonly settings: SettingsService,
  ) {}

  async recipientsSentSince(since: Date): Promise<number> {
    const row = await this.deliveries
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.recipient_count), 0)::int', 'total')
      .where(
        'd.status = :status AND d.sent_manually = false AND d.sent_at > :since',
        {
          status: DeliveryStatus.SENT,
          since,
        },
      )
      .getRawOne<{ total: number }>();
    return row?.total ?? 0;
  }

  async current(now = new Date()): Promise<Quota> {
    const settings = await this.settings.get();
    const used = await this.recipientsSentSince(
      new Date(now.getTime() - DAY_MS),
    );
    const paused = settings.pausedUntil && settings.pausedUntil > now;
    return {
      used,
      cap: settings.dailyRecipientCap,
      remaining: Math.max(0, settings.dailyRecipientCap - used),
      pausedUntil: paused ? settings.pausedUntil : null,
      pauseReason: paused ? settings.pauseReason : null,
    };
  }

  /** Emails that may still go out in this minute. */
  async minuteBudget(now = new Date()): Promise<number> {
    const { ratePerMinute } = await this.settings.get();
    const sentLastMinute = await this.deliveries
      .createQueryBuilder('d')
      .where(
        'd.status = :status AND d.sent_manually = false AND d.sent_at > :since',
        {
          status: DeliveryStatus.SENT,
          since: new Date(now.getTime() - MINUTE_MS),
        },
      )
      .getCount();
    return Math.max(0, ratePerMinute - sentLastMinute);
  }
}
