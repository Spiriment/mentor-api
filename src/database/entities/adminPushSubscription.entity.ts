import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm';

/** A browser that an admin allowed to receive web push (one row per browser/device). */
@Entity('admin_push_subscriptions')
export class AdminPushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_admin_push_subscriptions_admin')
  @Column({ name: 'adminUserId', type: 'varchar', length: 36 })
  adminUserId!: string;

  @Index('UQ_admin_push_subscriptions_endpoint', { unique: true })
  @Column({ type: 'varchar', length: 500 })
  endpoint!: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh!: string;

  @Column({ type: 'varchar', length: 255 })
  auth!: string;

  @Column({ name: 'userAgent', type: 'varchar', length: 255, nullable: true })
  userAgent?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
