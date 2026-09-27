import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EnvironmentVariables } from '../../config/env.validation';
import { EmailStep, StepStatus } from '../email/email-step.entity';
import {
  emailContextOf,
  STEP_DELIVERY_RELATIONS,
} from '../email/email-context';
import { missingVariablesOf } from '../email/variables';
import { ParticipationStatus } from '../tournament/domain/participation-process';
import { isPastDue } from '../email/domain/schedule';
import { SendingMode } from '../settings/setting.entity';
import { SettingsService } from '../settings/settings.service';
import {
  DeliverySenderService,
  INTERRUPTED_MESSAGE,
  pauseDurationMs,
} from './delivery-sender.service';
import { DeliveryStatus, EmailDelivery } from './email-delivery.entity';
import { QuotaService } from './quota.service';

/** A delivery locked longer than this was interrupted mid-send. */
const STALE_LOCK_MS = 10 * 60 * 1000;
/** Queued deliveries older than this are not sent anymore (e.g. after downtime or a long quota pause). */
const OVERDUE_MS = 24 * 60 * 60 * 1000;
const OVERDUE_MESSAGE =
  'Not sent within 24 hours of the planned time (server downtime or sending quota). Resend if still relevant.';
/** Arbitrary constant key for the Postgres advisory lock that serializes ticks across instances. */
const TICK_LOCK_KEY = 874_231_001;

@Injectable()
export class DeliverySchedulerService {
  private readonly logger = new Logger(DeliverySchedulerService.name);
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly sender: DeliverySenderService,
    private readonly quota: QuotaService,
    private readonly settings: SettingsService,
    private readonly env: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async onCron(): Promise<void> {
    if (this.env.get('SCHEDULER_ENABLED', { infer: true }) === false) return;
    await this.tick();
  }

  /** Runs a tick soon without blocking the caller (send-now, resends). */
  triggerSoon(): void {
    if (this.env.get('SCHEDULER_ENABLED', { infer: true }) === false) return;
    setImmediate(() => void this.tick());
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      const [{ locked }] = (await runner.query(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [TICK_LOCK_KEY],
      )) as {
        locked: boolean;
      }[];
      if (!locked) return; // another instance is ticking
      try {
        await this.failStaleLocks(now);
        await this.failOverdue(now);
        await this.materializeDueSteps(now);
        await this.sendQueued(now);
        await this.settleSteps();
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1)', [TICK_LOCK_KEY]);
      }
    } catch (error) {
      this.logger.error(`Scheduler tick failed: ${(error as Error).stack}`);
    } finally {
      await runner.release();
      this.running = false;
    }
  }

  /** At-most-once: never retry automatically when we cannot know whether Gmail accepted the mail. */
  private async failStaleLocks(now: Date): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(EmailDelivery)
      .set({
        status: DeliveryStatus.FAILED,
        lastError: INTERRUPTED_MESSAGE,
        lockedAt: null,
      })
      .where('status = :status AND locked_at < :stale', {
        status: DeliveryStatus.QUEUED,
        stale: new Date(now.getTime() - STALE_LOCK_MS),
      })
      .execute();
  }

  private async failOverdue(now: Date): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(EmailDelivery)
      .set({ status: DeliveryStatus.FAILED, lastError: OVERDUE_MESSAGE })
      .where(
        'status = :status AND locked_at IS NULL AND queued_at < :overdue',
        {
          status: DeliveryStatus.QUEUED,
          overdue: new Date(now.getTime() - OVERDUE_MS),
        },
      )
      .execute();
  }

  /** Due steps of teams that have not withdrawn from the tournament. */
  private async materializeDueSteps(now: Date): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const due: { id: string }[] = await em.query(
        `SELECT s.id FROM communication_steps s
           JOIN participations p ON p.id = s.participation_id
          WHERE s.status = $1 AND s.requires_decision = false AND s.resolved_send_at <= $2
            AND p.status <> $3
          FOR UPDATE OF s SKIP LOCKED`,
        [StepStatus.SCHEDULED, now, ParticipationStatus.WITHDRAWN],
      );
      for (const { id } of due) await this.materializeStep(em, id, now);
    });
  }

  /** Creates the step's delivery to its team (skipped if the team unsubscribed or is archived). */
  private async materializeStep(
    em: EntityManager,
    stepId: string,
    now: Date,
  ): Promise<void> {
    const step = await em.findOneOrFail(EmailStep, {
      where: { id: stepId },
      relations: { ...STEP_DELIVERY_RELATIONS, triggeredBy: true },
    });
    if (isPastDue(step.resolvedSendAt, true, now)) {
      await em.update(EmailStep, stepId, { requiresDecision: true });
      this.logger.warn(
        `Email ${stepId} missed its send window; waiting for a decision`,
      );
      return;
    }
    const missing = missingVariablesOf(step, emailContextOf(step).variables);
    if (missing.length > 0) {
      // Not sent until the tournament or team provides the values; it shows up in the work queue.
      this.logger.warn(
        `Email ${stepId} is due but misses variable(s): ${missing.join(', ')}`,
      );
      return;
    }
    const team = step.participation.team;
    const pendingStatus =
      (await this.settings.currentMode()) === SendingMode.MANUAL
        ? DeliveryStatus.READY
        : DeliveryStatus.QUEUED;
    const skipReason = team.unsubscribedAt
      ? 'unsubscribed'
      : team.isArchived
        ? 'archived'
        : null;
    await em
      .createQueryBuilder()
      .insert()
      .into(EmailDelivery)
      .values({
        step: { id: stepId },
        team: { id: team.id },
        toEmail: team.email,
        ccEmails: team.ccEmails,
        recipientCount: 1 + team.ccEmails.length,
        status: skipReason ? DeliveryStatus.SKIPPED : pendingStatus,
        skipReason,
        nextAttemptAt: now,
        queuedAt: now,
        triggeredBy: step.triggeredBy ? { id: step.triggeredBy.id } : null,
      })
      .orIgnore()
      .execute();
    await em.update(EmailStep, stepId, { status: StepStatus.SENDING });
  }

  private async sendQueued(now: Date): Promise<void> {
    if ((await this.settings.currentMode()) === SendingMode.MANUAL) return;
    const quota = await this.quota.current(now);
    if (quota.pausedUntil) return;
    let remaining = quota.remaining;
    let budget = await this.quota.minuteBudget(now);
    const settings = await this.settings.get();

    while (budget > 0) {
      const claimed = await this.claimNext(now, remaining);
      if (!claimed) return;
      const outcome = await this.sender.send(claimed.id, settings);
      if (outcome === 'QUOTA' || outcome === 'AUTH') {
        const reason =
          outcome === 'QUOTA'
            ? 'Gmail reported that the daily sending limit was reached'
            : 'Login to the mailbox failed – check the mail credentials';
        await this.settings.pauseSending(
          new Date(now.getTime() + pauseDurationMs(outcome)),
          reason,
        );
        return;
      }
      if (outcome === 'SENT') {
        budget--;
        remaining -= claimed.recipientCount;
      }
    }
  }

  /** Claims the next due delivery that fits into the remaining quota. */
  private async claimNext(
    now: Date,
    remaining: number,
  ): Promise<{ id: string; recipientCount: number } | null> {
    return this.dataSource.transaction(async (em) => {
      const rows: { id: string; recipient_count: number }[] = await em.query(
        `SELECT id, recipient_count FROM email_deliveries
          WHERE status = $1 AND next_attempt_at <= $2 AND locked_at IS NULL
          ORDER BY next_attempt_at, created_at
          LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [DeliveryStatus.QUEUED, now],
      );
      const row = rows[0];
      if (!row || row.recipient_count > remaining) return null;
      await em.query(
        `UPDATE email_deliveries SET locked_at = now(), attempts = attempts + 1 WHERE id = $1`,
        [row.id],
      );
      return { id: row.id, recipientCount: row.recipient_count };
    });
  }

  /** Marks steps SENT/FAILED once none of their deliveries is pending. */
  async settleSteps(): Promise<void> {
    await this.dataSource.query(
      `UPDATE communication_steps s
          SET status = CASE WHEN EXISTS (SELECT 1 FROM email_deliveries d WHERE d.step_id = s.id AND d.status = $1)
                            THEN $2::communication_steps_status_enum ELSE $3::communication_steps_status_enum END,
              sent_at = COALESCE(s.sent_at, now())
        WHERE s.status = $4
          AND NOT EXISTS (SELECT 1 FROM email_deliveries d WHERE d.step_id = s.id AND d.status = ANY($5))`,
      [
        DeliveryStatus.FAILED,
        StepStatus.FAILED,
        StepStatus.SENT,
        StepStatus.SENDING,
        [DeliveryStatus.QUEUED, DeliveryStatus.READY],
      ],
    );
  }
}
