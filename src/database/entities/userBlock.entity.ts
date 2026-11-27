import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import type { BlockSessionsReview } from '@/common/safety';

/**
 * One person blocking another. A block works both ways: neither can message, call, request
 * mentorship or book with the other. Unblocking keeps the row (unblockedAt) so admins can see
 * the history; blocking again reuses it. No foreign keys in the table (like user_push_tokens):
 * rows left by a removed account match nobody and are skipped when listed.
 */
@Entity('user_blocks')
@Unique('UQ_user_blocks_pair', ['blockerId', 'blockedId'])
export class UserBlock extends BaseEntity {
  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'blockerId' })
  blocker!: User;

  @Column({ type: 'varchar', length: 36 })
  blockerId!: string;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'blockedId' })
  blocked!: User;

  @Index('IDX_user_blocks_blockedId')
  @Column({ type: 'varchar', length: 36 })
  blockedId!: string;

  /** When the current block started (blocking again after an unblock moves it) */
  @Column({ type: 'datetime' })
  blockedAt!: Date;

  /** Set while unblocked; null while the block is in force */
  @Column({ type: 'datetime', nullable: true })
  unblockedAt?: Date | null;

  /** Upcoming sessions between the two waiting on an admin (see common/safety.ts) */
  @Index('IDX_user_blocks_sessionsReview')
  @Column({ type: 'varchar', length: 16, default: 'none' })
  sessionsReview!: BlockSessionsReview;

  /** The sessions that were booked when the block was made */
  @Column({ type: 'json', nullable: true })
  affectedSessionIds?: string[] | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByAdminId?: string | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes?: string | null;
}
