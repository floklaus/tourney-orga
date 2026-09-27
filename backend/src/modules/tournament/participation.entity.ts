import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
  Unique,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Team } from '../team/team.entity';
import { User } from '../user/user.entity';
import { ParticipationStatus } from './domain/participation-process';
import { Tournament } from './tournament.entity';

/** A team going to a tournament, moving through the participation process. */
@Entity('participations')
@Unique('uq_participation_tournament_team', ['tournament', 'team'])
export class Participation extends BaseEntity {
  @ManyToOne(() => Tournament, (t) => t.participations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  tournament: Tournament;

  @RelationId((p: Participation) => p.tournament)
  tournamentId: string;

  @ManyToOne(() => Team, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  team: Team;

  @RelationId((p: Participation) => p.team)
  teamId: string;

  @Column({ type: 'varchar', nullable: true })
  ageGroup: string | null;

  /** The tournament days (YYYY-MM-DD) the team plays on; at least one. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  days: string[];

  @Column({
    type: 'enum',
    enum: ParticipationStatus,
    default: ParticipationStatus.SIGNED_UP,
  })
  status: ParticipationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Per-team overrides of the tournament variables. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  variables: Record<string, string>;

  @Column({ type: 'timestamptz', nullable: true })
  withdrawnAt: Date | null;

  @OneToMany(() => ParticipationStatusChange, (c) => c.participation)
  history: ParticipationStatusChange[];

  @VersionColumn()
  version: number;
}

/** Audit trail of status changes; also provides when each step was completed. */
@Entity('participation_status_changes')
export class ParticipationStatusChange extends BaseEntity {
  @ManyToOne(() => Participation, (p) => p.history, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  participation: Participation;

  @Column({ type: 'enum', enum: ParticipationStatus, nullable: true })
  fromStatus: ParticipationStatus | null;

  @Column({ type: 'enum', enum: ParticipationStatus })
  toStatus: ParticipationStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Set by the app (not now()): several changes in one transaction need distinct, ordered times. */
  @Column({ type: 'timestamptz' })
  changedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  changedBy: User | null;
}
