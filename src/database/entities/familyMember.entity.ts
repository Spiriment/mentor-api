import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { FamilyPlan } from './familyPlan.entity';
import { User } from './user.entity';
import { SubscriptionTier } from './userSubscription.entity';

@Entity('family_members')
export class FamilyMember extends BaseEntity {
  @ManyToOne(() => FamilyPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyPlanId' })
  familyPlan!: FamilyPlan;

  @Column({ name: 'familyPlanId', type: 'varchar', length: 36 })
  familyPlanId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'userId', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 24, default: 'basic' })
  tier!: SubscriptionTier;

  @Column({ name: 'ageDiscountPercent', type: 'int', default: 0 })
  ageDiscountPercent!: number;

  @Column({ name: 'stripeSubscriptionId', type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId?: string | null;

  @Column({ name: 'isParent', type: 'boolean', default: false })
  isParent!: boolean;
}
