import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export type FamilyPlanStatus = 'active' | 'inactive';

@Entity('family_plans')
export class FamilyPlan extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: FamilyPlanStatus;

  @Column({ name: 'parentUserId', type: 'varchar', length: 36 })
  parentUserId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentUserId' })
  parent!: User;
}
