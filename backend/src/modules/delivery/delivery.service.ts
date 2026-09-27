import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { conflict, notFound } from '../../common/errors';
import { EmailStep, StepStatus } from '../email/email-step.entity';
import { SendingMode } from '../settings/setting.entity';
import { SettingsService } from '../settings/settings.service';
import { User } from '../user/user.entity';
import { toUserRef } from '../user/user.mapper';
import { DeliveryStatus, EmailDelivery } from './email-delivery.entity';

export interface DeliveryCounts {
  queued: number;
  ready: number;
  sent: number;
  failed: number;
  skipped: number;
}

export const toDeliveryResponse = (d: EmailDelivery) => ({
  id: d.id,
  stepId: d.stepId,
  team: d.team ? { id: d.team.id, name: d.team.name } : null,
  toEmail: d.toEmail,
  ccEmails: d.ccEmails,
  renderedSubject: d.renderedSubject,
  status: d.status,
  attempts: d.attempts,
  lastError: d.lastError,
  skipReason: d.skipReason,
  sentAt: d.sentAt,
  triggeredBy: toUserRef(d.triggeredBy),
  sentManually: d.sentManually,
  markedSentBy: toUserRef(d.markedSentBy),
  step: d.step ? { id: d.step.id, name: d.step.name } : null,
  participationId: d.step?.participation?.id ?? null,
  tournament: d.step?.participation?.tournament
    ? {
        id: d.step.participation.tournament.id,
        name: d.step.participation.tournament.name,
      }
    : null,
  createdAt: d.createdAt,
});

/** Relations needed for toDeliveryResponse. */
const RESPONSE_RELATIONS = {
  team: true,
  triggeredBy: true,
  markedSentBy: true,
  step: { participation: { tournament: true } },
} as const;

export type DeliveryBulkAction = 'dismiss' | 'resend';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  async findByStep(
    stepId: string,
    status?: DeliveryStatus,
  ): Promise<EmailDelivery[]> {
    await this.assertStepExists(stepId);
    return this.deliveries.find({
      where: { step: { id: stepId }, ...(status ? { status } : {}) },
      relations: RESPONSE_RELATIONS,
      order: { createdAt: 'ASC', toEmail: 'ASC' },
    });
  }

  /** All deliveries across tournaments, for the generic deliveries list. */
  findAll(): Promise<EmailDelivery[]> {
    return this.deliveries.find({ relations: RESPONSE_RELATIONS });
  }

  /** Delivery counts per step, for many steps at once. */
  async countsByStep(stepIds: string[]): Promise<Map<string, DeliveryCounts>> {
    const result = new Map<string, DeliveryCounts>();
    if (stepIds.length === 0) return result;
    const rows: { step_id: string; status: DeliveryStatus; count: number }[] =
      await this.dataSource.query(
        `SELECT step_id, status, COUNT(*)::int AS count FROM email_deliveries
        WHERE step_id = ANY($1) GROUP BY step_id, status`,
        [stepIds],
      );
    for (const row of rows) {
      const counts = result.get(row.step_id) ?? {
        queued: 0,
        ready: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
      counts[row.status.toLowerCase() as keyof DeliveryCounts] = row.count;
      result.set(row.step_id, counts);
    }
    return result;
  }

  async resend(user: User, id: string): Promise<EmailDelivery> {
    const delivery = await this.deliveries.findOne({
      where: { id },
      relations: { step: true },
    });
    if (!delivery) throw notFound('Delivery');
    const requeued = await this.requeue(user, delivery.stepId, [id]);
    if (requeued === 0) throw conflict('Only failed deliveries can be resent');
    return this.deliveries.findOneOrFail({
      where: { id },
      relations: RESPONSE_RELATIONS,
    });
  }

  /** Resends or dismisses many failed deliveries; reports each one's outcome. */
  async bulk(user: User, ids: string[], action: DeliveryBulkAction) {
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const id of ids) {
      try {
        if (action === 'resend') await this.resend(user, id);
        else await this.dismiss(id);
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, error: (error as Error).message });
      }
    }
    return results;
  }

  /** Gives up on a failed email (e.g. outdated) so it leaves the work queue. */
  async dismiss(id: string): Promise<void> {
    const delivery = await this.deliveries.findOne({ where: { id } });
    if (!delivery) throw notFound('Delivery');
    await this.dataSource.transaction(async (em) => {
      const { affected } = await em.update(
        EmailDelivery,
        { id, status: DeliveryStatus.FAILED },
        { status: DeliveryStatus.SKIPPED, skipReason: 'dismissed' },
      );
      if (!affected) throw conflict('Only failed emails can be dismissed');
      // A step with nothing left to do counts as done.
      await em.query(
        `UPDATE communication_steps s SET status = $2, sent_at = COALESCE(s.sent_at, now())
          WHERE s.id = $1 AND s.status = ANY($3)
           AND NOT EXISTS (SELECT 1 FROM email_deliveries d WHERE d.step_id = s.id AND d.status = ANY($4))`,
        [
          delivery.stepId,
          StepStatus.SENT,
          [StepStatus.FAILED, StepStatus.SENDING],
          [DeliveryStatus.FAILED, DeliveryStatus.QUEUED, DeliveryStatus.READY],
        ],
      );
    });
  }

  /** Requeues only rows that are still FAILED, so double clicks cannot resend a delivered mail. */
  private async requeue(
    user: User,
    stepId: string,
    ids: string[],
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const target =
      (await this.settings.currentMode()) === SendingMode.MANUAL
        ? DeliveryStatus.READY
        : DeliveryStatus.QUEUED;
    return this.dataSource.transaction(async (em) => {
      const now = new Date();
      const result = await em
        .createQueryBuilder()
        .update(EmailDelivery)
        .set({
          status: target,
          attempts: 0,
          lastError: null,
          nextAttemptAt: now,
          queuedAt: now,
          triggeredBy: { id: user.id },
        })
        .where('id IN (:...ids) AND status = :failed', {
          ids,
          failed: DeliveryStatus.FAILED,
        })
        .execute();
      const requeued = result.affected ?? 0;
      if (requeued > 0)
        await em.update(EmailStep, stepId, {
          status: StepStatus.SENDING,
        });
      return requeued;
    });
  }

  private async assertStepExists(stepId: string): Promise<void> {
    if (
      !(await this.dataSource.getRepository(EmailStep).existsBy({ id: stepId }))
    )
      throw notFound('Step');
  }
}
