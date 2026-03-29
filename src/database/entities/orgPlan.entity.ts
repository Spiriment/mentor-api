import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export type OrgPlanType = 'church' | 'family';
export type OrgPlanStatus = 'active' | 'inactive';

@Entity('org_plans')
export class OrgPlan extends BaseEntity {
  @Column({ name: 'planType', type: 'varchar', length: 16 })
  planType!: OrgPlanType;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 24, default: 'active' })
  status!: OrgPlanStatus;

  @Column({ name: 'totalSeats', type: 'int', default: 0 })
  totalSeats!: number;

  @Column({ name: 'usedSeats', type: 'int', default: 0 })
  usedSeats!: number;

  @Column({ name: 'billingAdminUserId', type: 'varchar', length: 36, nullable: true })
  billingAdminUserId?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;
}
