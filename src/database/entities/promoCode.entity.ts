import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export type PromoCodeType = 'ambassador' | 'internal_test';

@Entity('promo_codes')
export class PromoCode extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: ['ambassador', 'internal_test'], default: 'ambassador' })
  type!: PromoCodeType;

  @Column({ type: 'int', default: 20 })
  discountPercent!: number;

  @Column({ type: 'varchar', length: 24, default: 'premium' })
  tier!: string;

  @Column({ type: 'int', nullable: true })
  usageLimit?: number | null;

  @Column({ type: 'int', default: 0 })
  usedCount!: number;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string | null;
}
