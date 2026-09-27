import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { TeamGroup } from './team-group.entity';

@Entity('teams')
export class Team extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column()
  contactName: string;

  @Column()
  email: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  ccEmails: string[];

  /** High-school graduation year of the players; the age group is calculated from it. */
  @Column({ type: 'int', nullable: true })
  graduationYear: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  unsubscribedAt: Date | null;

  @Column({ unique: true })
  unsubscribeToken: string;

  @ManyToMany(() => TeamGroup, (group) => group.teams)
  @JoinTable({
    name: 'team_group_members',
    joinColumn: { name: 'team_id' },
    inverseJoinColumn: { name: 'group_id' },
  })
  groups: TeamGroup[];
}
