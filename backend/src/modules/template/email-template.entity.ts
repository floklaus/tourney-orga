import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('email_templates')
export class EmailTemplate extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  bodyHtml: string;

  @Column({ type: 'text' })
  bodyText: string;
}
