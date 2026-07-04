import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('mrr_snapshots')
@Index(['year', 'month'], { unique: true })
export class MrrSnapshot extends BaseEntity {
  @Column({ type: 'smallint' })
  year!: number;

  /** Calendar month 1–12 */
  @Column({ type: 'tinyint' })
  month!: number;

  @Column({ name: 'mrrCents', type: 'int', default: 0 })
  mrrCents!: number;

  @Column({ type: 'varchar', length: 8, default: 'EUR' })
  currency!: string;

  @Column({ name: 'activeSubscribers', type: 'int', default: 0 })
  activeSubscribers!: number;
}
