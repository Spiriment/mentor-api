import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('referrals')
export class Referral extends BaseEntity {
  @Index()
  @Column({ name: 'referrerId', type: 'varchar', length: 36 })
  referrerId!: string;

  @Index()
  @Column({ name: 'referredUserId', type: 'varchar', length: 36, unique: true })
  referredUserId!: string;

  /** Points awarded for this referral */
  @Column({ name: 'pointsAwarded', type: 'int', default: 10 })
  pointsAwarded!: number;
}
