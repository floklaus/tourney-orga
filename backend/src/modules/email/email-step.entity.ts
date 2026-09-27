import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  RelationId,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { EmailTemplate } from '../template/email-template.entity';
import { Participation } from '../tournament/participation.entity';
import { User } from '../user/user.entity';
import type { Anchor } from './domain/send-time';

export enum TimingType {
  ABSOLUTE = 'ABSOLUTE',
  RELATIVE = 'RELATIVE',
}

export enum StepStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PAUSED = 'PAUSED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/** Steps whose content and timing may still change. */
export const EDITABLE_STEP_STATUSES = [
  StepStatus.DRAFT,
  StepStatus.SCHEDULED,
  StepStatus.PAUSED,
];
/** Steps whose email has not been fully handled yet. */
export const UNSENT_STEP_STATUSES = [
  ...EDITABLE_STEP_STATUSES,
  StepStatus.SENDING,
];

/** One planned email to the team of a participation (table name kept from the campaign era). */
@Entity('communication_steps')
@Check(
  'chk_step_relative',
  `timing_type <> 'RELATIVE' OR (offset_days IS NOT NULL AND time_of_day IS NOT NULL)`,
)
@Check('chk_step_absolute', `timing_type <> 'ABSOLUTE' OR send_at IS NOT NULL`)
export class EmailStep extends BaseEntity {
  @ManyToOne(() => Participation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  participation: Participation;

  @RelationId((step: EmailStep) => step.participation)
  participationId: string;

  /** The tournament email plan item this step was copied from (null = added for this team only). */
  @Column({ type: 'uuid', nullable: true })
  planItemId: string | null;

  @Column()
  name: string;

  @ManyToOne(() => EmailTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  template: EmailTemplate | null;

  @Column({ type: 'varchar', nullable: true })
  subjectOverride: string | null;

  @Column({ type: 'enum', enum: TimingType })
  timingType: TimingType;

  @Column({ type: 'timestamptz', nullable: true })
  sendAt: Date | null;

  @Column({ type: 'int', nullable: true })
  offsetDays: number | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  timeOfDay: string | null;

  @Column({ type: 'varchar', length: 5, default: 'START' })
  anchor: Anchor;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  resolvedSendAt: Date | null;

  @Column({ type: 'enum', enum: StepStatus, default: StepStatus.SCHEDULED })
  status: StepStatus;

  /** Set when the send time passed without sending; the organizer must choose send-now or skip. */
  @Column({ default: false })
  requiresDecision: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  /** Who triggered the send (send-now); null = scheduler. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  triggeredBy: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  createdBy: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  updatedBy: User | null;

  @VersionColumn()
  version: number;
}
