import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export type UserDiscountType = 'percent' | 'fixed';

@Entity('user_discounts')
export class UserDiscount extends BaseEntity {
  @Column({ name: 'userId', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'discountType', type: 'varchar', length: 16 })
  discountType!: UserDiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label?: string | null;

  @Column({ name: 'validFrom', type: 'datetime', nullable: true })
  validFrom?: Date | null;

  @Column({ name: 'validUntil', type: 'datetime', nullable: true })
  validUntil?: Date | null;

  @Column({ name: 'createdByAdminId', type: 'varchar', length: 36, nullable: true })
  createdByAdminId?: string | null;
}
