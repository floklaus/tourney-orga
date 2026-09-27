import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { MilestoneRule } from '../tournament/domain/participation-process';

export const SETTINGS_ID = 1;

export enum SendingMode {
  /** Due emails are sent through the configured mailbox. */
  AUTOMATIC = 'AUTOMATIC',
  /** Due emails are only prepared; the organizer copies, sends and marks them. */
  MANUAL = 'MANUAL',
}

@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'int', default: SETTINGS_ID })
  id: number;

  @Column({ default: '' })
  organizerName: string;

  @Column({ default: '' })
  senderName: string;

  @Column({ type: 'varchar', nullable: true })
  replyToEmail: string | null;

  @Column({ default: 'Europe/Berlin' })
  timezone: string;

  /** Month (1–12) in which the school year, and with it every team's age group, rolls over. */
  @Column({ type: 'int', default: 9 })
  seasonStartMonth: number;

  @Column({ type: 'text', nullable: true })
  footerHtml: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'enum', enum: SendingMode, default: SendingMode.AUTOMATIC })
  sendingMode: SendingMode;

  @Column({ type: 'int', default: 20 })
  ratePerMinute: number;

  @Column({ type: 'int', default: 1000 })
  dailyRecipientCap: number;

  /** Default participation timeline, copied into new tournaments. Null = built-in defaults. */
  @Column({ type: 'jsonb', nullable: true })
  participationDefaults: MilestoneRule[] | null;

  /** Set after Gmail reports a quota error; sending resumes afterwards. */
  @Column({ type: 'timestamptz', nullable: true })
  pausedUntil: Date | null;

  @Column({ type: 'varchar', nullable: true })
  pauseReason: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
