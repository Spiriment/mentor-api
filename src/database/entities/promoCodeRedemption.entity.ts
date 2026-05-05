import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PromoCode } from './promoCode.entity';
import { User } from './user.entity';

@Entity('promo_code_redemptions')
export class PromoCodeRedemption extends BaseEntity {
  @ManyToOne(() => PromoCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promoCodeId' })
  promoCode!: PromoCode;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  redeemedAt!: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  stripeCouponId?: string | null;
}
