import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export type SubscriptionTier = 'basic' | 'pro' | 'premium' | 'none';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due';

@Entity('user_subscriptions')
export class UserSubscription extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 24 })
  tier!: SubscriptionTier;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: SubscriptionStatus;

  @Column({ name: 'mrrCents', type: 'int', nullable: true })
  mrrCents?: number | null;

  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency!: string;

  @Column({ name: 'expiresAt', type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'externalProvider', type: 'varchar', length: 64, nullable: true })
  externalProvider?: string | null;

  @Column({ name: 'externalRef', type: 'varchar', length: 255, nullable: true })
  externalRef?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string | null;
}
