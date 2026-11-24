import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * One row per device a person is signed in on (phone, tablet…). Every push goes to all of
 * them. users.pushToken still holds the most recent one, for code that checks "has a device".
 */
@Entity('user_push_tokens')
export class UserPushToken extends BaseEntity {
  @Index('IDX_user_push_tokens_user')
  @Column({ type: 'varchar', length: 36 })
  userId!: string;

  /** Expo push token. Unique: a device signed in to another account moves to that account. */
  @Index('UQ_user_push_tokens_token', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  token!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  platform!: string | null;

  /** Last time the app on this device registered (every launch) */
  @Column({ type: 'datetime' })
  lastSeenAt!: Date;
}
