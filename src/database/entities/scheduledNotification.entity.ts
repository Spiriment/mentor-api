import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type NotificationType = 'welcome' | 'session_reminder' | 'message' | 'other';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

@Entity('scheduled_notifications')
@Index(['scheduledFor', 'status'])
@Index(['userId', 'status'])
export class ScheduledNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  pushToken: string;

  @Column({
    type: 'enum',
    enum: ['welcome', 'session_reminder', 'message', 'other'],
    default: 'other',
  })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ type: 'timestamp' })
  @Index()
  scheduledFor: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
  })
  @Index()
  status: NotificationStatus;

  @Column({ type: 'timestamp', nullable: true })
  sentAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
