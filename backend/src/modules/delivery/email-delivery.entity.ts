import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  RelationId,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { EmailStep } from '../email/email-step.entity';
import { Team } from '../team/team.entity';
import { User } from '../user/user.entity';

export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  /** Prepared for manual sending: the organizer copies it and marks it as sent. */
  READY = 'READY',
  SENT = 'SENT',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

@Entity('email_deliveries')
@Unique('uq_delivery_step_team', ['step', 'team'])
@Index('idx_delivery_due', ['status', 'nextAttemptAt'])
export class EmailDelivery extends BaseEntity {
  @ManyToOne(() => EmailStep, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  step: EmailStep;

  @RelationId((d: EmailDelivery) => d.step)
  stepId: string;

  /** Null once the team was deleted (delivery anonymized). */
  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  team: Team | null;

  @Column()
  toEmail: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  ccEmails: string[];

  @Column({ type: 'varchar', default: '' })
  renderedSubject: string;

  @Column({ type: 'text', default: '' })
  renderedBodyHtml: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.QUEUED,
  })
  status: DeliveryStatus;

  @Column({ type: 'varchar', nullable: true })
  skipReason: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  /** When the delivery was (re)queued; used to stop sending mails that are a day late. */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  queuedAt: Date;

  /** Set while an SMTP call is in flight; a stale lock means the process died mid-send. */
  @Column({ type: 'timestamptz', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId: string | null;

  /** Recipients this delivery counts against the rolling quota (to + cc). */
  @Column({ type: 'int', default: 1 })
  recipientCount: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  triggeredBy: User | null;

  /** Sent by the organizer from their own mail program, not by the app. */
  @Column({ default: false })
  sentManually: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  markedSentBy: User | null;
}
