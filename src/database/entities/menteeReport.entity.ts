import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

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
}
