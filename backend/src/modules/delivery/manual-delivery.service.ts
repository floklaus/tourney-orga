import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { conflict, notFound } from '../../common/errors';
import { EmailStep, StepStatus } from '../email/email-step.entity';
import {
  emailContextOf,
  STEP_DELIVERY_RELATIONS,
} from '../email/email-context';
import { htmlToText } from '../mail/mail-layout';
import { SettingsService } from '../settings/settings.service';
import { EmailRendererService } from '../template/email-renderer.service';
import { User } from '../user/user.entity';
import { DeliverySchedulerService } from './delivery-scheduler.service';
import { DeliveryStatus, EmailDelivery } from './email-delivery.entity';
import {
  missingVariablesError,
  missingVariablesOf,
  stepContent,
} from '../email/variables';

/** Mail programs and browsers cut long mailto: links; keep the body below this. */
const MAILTO_BODY_LIMIT = 1800;
const MARKABLE = [DeliveryStatus.READY, DeliveryStatus.FAILED];

export interface ManualMessage {
  deliveryId: string;
  status: DeliveryStatus;
  to: string;
  cc: string[];
  subject: string;
  html: string;
  text: string;
  mailtoUrl: string;
  mailtoTruncated: boolean;
}

/** Manual sending: the organizer copies a prepared message, sends it themselves and marks it as sent. */
@Injectable()
export class ManualDeliveryService {
  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly renderer: EmailRendererService,
    private readonly settings: SettingsService,
    private readonly scheduler: DeliverySchedulerService,
  ) {}

  /** Sent deliveries show what was sent; all others are rendered with current data. */
  async message(id: string): Promise<ManualMessage> {
    const delivery = await this.load(id);
    if (delivery.status === DeliveryStatus.SENT) {
      return buildMessage(delivery, delivery.toEmail, delivery.ccEmails, {
        subject: delivery.renderedSubject,
        html: delivery.renderedBodyHtml,
      });
    }
    const rendered = await this.render(delivery);
    return buildMessage(delivery, rendered.to, rendered.cc, rendered);
  }

  async markSent(user: User, id: string): Promise<EmailDelivery> {
    const delivery = await this.load(id);
    if (!MARKABLE.includes(delivery.status))
      throw conflict('Only ready or failed emails can be marked as sent');
    const rendered = await this.render(delivery);
    const { affected } = await this.deliveries.update(
      { id, status: In(MARKABLE) },
      {
        status: DeliveryStatus.SENT,
        sentManually: true,
        sentAt: new Date(),
        markedSentBy: { id: user.id },
        toEmail: rendered.to,
        ccEmails: rendered.cc,
        recipientCount: 1 + rendered.cc.length,
        renderedSubject: rendered.subject,
        renderedBodyHtml: rendered.html,
        lastError: null,
        lockedAt: null,
      },
    );
    if (!affected)
      throw conflict(
        'This email was changed in the meantime. Reload and try again.',
      );
    await this.scheduler.settleSteps();
    return this.findWithRefs(id);
  }

  /** Undo for a mistaken "mark as sent": back to READY, reopening the step if it was already settled. */
  async markUnsent(id: string): Promise<EmailDelivery> {
    const delivery = await this.load(id);
    await this.dataSource.transaction(async (em) => {
      const { affected } = await em.update(
        EmailDelivery,
        { id, status: DeliveryStatus.SENT, sentManually: true },
        {
          status: DeliveryStatus.READY,
          sentManually: false,
          sentAt: null,
          markedSentBy: null,
        },
      );
      if (!affected)
        throw conflict('Only emails marked as sent manually can be undone');
      await em.update(EmailStep, delivery.stepId, {
        status: StepStatus.SENDING,
        sentAt: null,
      });
    });
    return this.findWithRefs(id);
  }

  async markAllSent(user: User, stepId: string): Promise<number> {
    const ready = await this.deliveries.find({
      where: { step: { id: stepId }, status: DeliveryStatus.READY },
      select: { id: true },
    });
    if (
      ready.length === 0 &&
      !(await this.dataSource.getRepository(EmailStep).existsBy({ id: stepId }))
    ) {
      throw notFound('Step');
    }
    const step = await this.dataSource
      .getRepository(EmailStep)
      .findOne({ where: { id: stepId }, relations: STEP_DELIVERY_RELATIONS });
    const missing = step
      ? missingVariablesOf(step, emailContextOf(step).variables)
      : [];
    if (missing.length > 0) throw missingVariablesError(missing);
    let marked = 0;
    for (const { id } of ready) {
      // Each one gets its own snapshot; skip rows another admin marked meanwhile.
      marked += await this.markSent(user, id).then(
        () => 1,
        () => 0,
      );
    }
    return marked;
  }

  private async render(delivery: EmailDelivery) {
    const { team, step } = delivery;
    if (!team) throw conflict('The team of this email was deleted');
    const content = stepContent(step);
    if (!content) throw conflict('The template of this step was deleted');
    const context = emailContextOf(step);
    const missing = missingVariablesOf(step, context.variables);
    if (missing.length > 0) throw missingVariablesError(missing);
    const email = this.renderer.render(
      content,
      team,
      context,
      await this.settings.get(),
    );
    return {
      to: team.email,
      cc: team.ccEmails,
      subject: email.subject,
      html: email.copyHtml,
      text: email.copyText,
    };
  }

  private async load(id: string): Promise<EmailDelivery> {
    const delivery = await this.deliveries.findOne({
      where: { id },
      relations: { step: STEP_DELIVERY_RELATIONS, team: true },
    });
    if (!delivery) throw notFound('Delivery');
    return delivery;
  }

  private findWithRefs(id: string): Promise<EmailDelivery> {
    return this.deliveries.findOneOrFail({
      where: { id },
      relations: { team: true, triggeredBy: true, markedSentBy: true },
    });
  }
}

function buildMessage(
  delivery: EmailDelivery,
  to: string,
  cc: string[],
  content: { subject: string; html: string; text?: string },
): ManualMessage {
  const text = content.text ?? htmlToText(content.html);
  const truncated = text.length > MAILTO_BODY_LIMIT;
  const body = truncated ? `${text.slice(0, MAILTO_BODY_LIMIT)}…` : text;
  const query = [
    cc.length > 0 ? `cc=${cc.map(encodeAddress).join(',')}` : null,
    `subject=${encodeURIComponent(content.subject)}`,
    `body=${encodeURIComponent(body)}`,
  ].filter(Boolean);
  return {
    deliveryId: delivery.id,
    status: delivery.status,
    to,
    cc,
    subject: content.subject,
    html: content.html,
    text,
    mailtoUrl: `mailto:${encodeAddress(to)}?${query.join('&')}`,
    mailtoTruncated: truncated,
  };
}

/** Keeps "@" readable while encoding everything else that could break the URL. */
const encodeAddress = (address: string) =>
  address.split('@').map(encodeURIComponent).join('@');
