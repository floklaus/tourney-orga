import { Column, Entity, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Team } from './team.entity';

@Entity('team_groups')
export class TeamGroup extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToMany(() => Team, (team) => team.groups)
  teams: Team[];
}
