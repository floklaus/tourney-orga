import { Check, Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { MilestoneRule } from './domain/participation-process';
import { Participation } from './participation.entity';
import type { EmailPlanItem } from '../email/email-plan';

@Entity('tournaments')
@Check('chk_tournament_dates', 'end_date >= start_date')
export class Tournament extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  /** Calendar dates (YYYY-MM-DD), no time or timezone. */
  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  ageGroups: string[];

  /** When each process step is due, relative to the tournament dates. */
  @Column({ type: 'jsonb' })
  milestones: MilestoneRule[];

  /** Values for {{tournament.vars.<key>}}; a participation can override them. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  variables: Record<string, string>;

  /** Emails copied to each participation when a team signs up. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  emailPlan: EmailPlanItem[];

  @OneToMany(() => Participation, (p) => p.tournament)
  participations: Participation[];
}
