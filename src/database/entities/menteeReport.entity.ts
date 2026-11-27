import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import type { ContextMessage } from '@/common/safety';

export type MenteeReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed';

@Entity('mentee_reports')
export class MenteeReport extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter!: User;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  reporterId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportedUserId' })
  reportedUser!: User;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  reportedUserId!: string;

  @Column({ type: 'varchar', length: 128 })
  reason!: string;

  @Column({ type: 'text', nullable: true })
  details?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  sessionId?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'open' })
  status!: MenteeReportStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  assignedTo?: string | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string | null;

  /** Where in the app the report was made (see common/safety REPORT_SOURCES) */
  @Column({ type: 'varchar', length: 16, nullable: true })
  source?: string | null;

  /** The reported message, when a message was reported */
  @Column({ type: 'varchar', length: 36, nullable: true })
  messageId?: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  conversationId?: string | null;

  /**
   * Copy of the messages around the reported one, taken when the report was made, so admins
   * see what happened even if the sender deletes the message afterwards
   */
  @Column({ type: 'json', nullable: true })
  context?: { messages: ContextMessage[]; reportedMessageId: string } | null;
}
