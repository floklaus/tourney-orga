import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMailService } from '../mail/system-mail.service';
import { MAIL_TRANSPORT, type MailTransport } from '../mail/mail-transport';
import { Setting } from '../settings/setting.entity';
import { EmailRendererService } from '../template/email-renderer.service';
import {
  classifySmtpError,
  nextRetryDelayMs,
  SmtpErrorKind,
  SmtpErrorLike,
} from './domain/smtp-error';
import { DeliveryStatus, EmailDelivery } from './email-delivery.entity';
import {
  emailContextOf,
  STEP_DELIVERY_RELATIONS,
} from '../email/email-context';
import { missingVariablesOf, stepContent } from '../email/variables';

export const INTERRUPTED_MESSAGE =
  'Sending was interrupted. Check the Sent folder of the mailbox before resending to avoid a duplicate.';

export type SendOutcome =
  'SENT' | 'SKIPPED' | 'FAILED' | 'RETRY' | 'BLOCKED' | SmtpErrorKind;

/** How often a delivery waiting for tournament variables is checked again. */
const BLOCKED_RECHECK_MS = 5 * 60 * 1000;

const QUOTA_PAUSE_MS = 24 * 60 * 60 * 1000;
const AUTH_PAUSE_MS = 15 * 60 * 1000;

@Injectable()
export class DeliverySenderService {
  private readonly logger = new Logger(DeliverySenderService.name);

  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly renderer: EmailRendererService,
    private readonly systemMail: SystemMailService,
  ) {}

  /** Sends one already-claimed delivery and records the outcome. Never throws. */
  async send(deliveryId: string, settings: Setting): Promise<SendOutcome> {
    const delivery = await this.deliveries.findOne({
      where: { id: deliveryId },
      relations: { step: STEP_DELIVERY_RELATIONS, team: true },
    });
    if (!delivery) return 'FAILED';
    const { team, step } = delivery;

    if (!team)
      return this.finish(
        delivery,
        { status: DeliveryStatus.FAILED, lastError: 'Team was deleted' },
        'FAILED',
      );
    if (team.unsubscribedAt) return this.skip(delivery, 'unsubscribed');
    if (team.isArchived) return this.skip(delivery, 'archived');

    const content = stepContent(step);
    if (!content) {
      return this.finish(
        delivery,
        { status: DeliveryStatus.FAILED, lastError: 'Template was deleted' },
        'FAILED',
      );
    }

    const context = emailContextOf(step);
    const missing = missingVariablesOf(step, context.variables);
    if (missing.length > 0) {
      // Not the recipient's fault and not an attempt: wait for the organizer to fill the values.
      return this.finish(
        delivery,
        {
          attempts: delivery.attempts - 1,
          lastError: `Waiting for tournament variable(s): ${missing.join(', ')}`,
          nextAttemptAt: new Date(Date.now() + BLOCKED_RECHECK_MS),
        },
        'BLOCKED',
      );
    }

    const email = this.renderer.render(content, team, context, settings);
    const ccEmails = team.ccEmails;
    try {
      const { messageId } = await this.transport.send({
        from: await this.systemMail.fromHeader(),
        to: team.email,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        replyTo: settings.replyToEmail ?? undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          'List-Unsubscribe': `<${email.oneClickUnsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      return this.finish(
        delivery,
        {
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          providerMessageId: messageId,
          toEmail: team.email,
          ccEmails,
          recipientCount: 1 + ccEmails.length,
          renderedSubject: email.subject,
          renderedBodyHtml: email.html,
          lastError: null,
        },
        'SENT',
      );
    } catch (error) {
      return this.handleError(delivery, error as SmtpErrorLike);
    }
  }

  private async handleError(
    delivery: EmailDelivery,
    error: SmtpErrorLike,
  ): Promise<SendOutcome> {
    const kind = classifySmtpError(error);
    const lastError = (
      error.response ??
      error.message ??
      'Unknown SMTP error'
    ).slice(0, 1000);
    this.logger.warn(`Delivery ${delivery.id} failed (${kind}): ${lastError}`);
    switch (kind) {
      case 'QUOTA':
      case 'AUTH':
        // Not the recipient's fault: give the attempt back and let the scheduler pause.
        await this.finish(
          delivery,
          { attempts: delivery.attempts - 1, lastError },
          kind,
        );
        return kind;
      case 'PERMANENT':
        return this.finish(
          delivery,
          { status: DeliveryStatus.FAILED, lastError },
          'FAILED',
        );
      case 'AMBIGUOUS':
        // Gmail may already have accepted it: never retry automatically.
        return this.finish(
          delivery,
          {
            status: DeliveryStatus.FAILED,
            lastError: `${INTERRUPTED_MESSAGE} (${lastError})`,
          },
          'FAILED',
        );
      case 'TRANSIENT': {
        const delay = nextRetryDelayMs(delivery.attempts);
        if (delay === null)
          return this.finish(
            delivery,
            { status: DeliveryStatus.FAILED, lastError },
            'FAILED',
          );
        return this.finish(
          delivery,
          { lastError, nextAttemptAt: new Date(Date.now() + delay) },
          'RETRY',
        );
      }
    }
  }

  private skip(
    delivery: EmailDelivery,
    skipReason: string,
  ): Promise<SendOutcome> {
    return this.finish(
      delivery,
      { status: DeliveryStatus.SKIPPED, skipReason },
      'SKIPPED',
    );
  }

  private async finish(
    delivery: EmailDelivery,
    changes: Partial<EmailDelivery>,
    outcome: SendOutcome,
  ): Promise<SendOutcome> {
    await this.deliveries.update(delivery.id, { ...changes, lockedAt: null });
    return outcome;
  }
}

export const pauseDurationMs = (kind: 'QUOTA' | 'AUTH') =>
  kind === 'QUOTA' ? QUOTA_PAUSE_MS : AUTH_PAUSE_MS;
