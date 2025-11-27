import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum AppNotificationType {
  SESSION_REQUEST = 'session_request',
  SESSION_CONFIRMED = 'session_confirmed',
  SESSION_RESCHEDULED = 'session_rescheduled',
  SESSION_DECLINED = 'session_declined',
  SESSION_REMINDER = 'session_reminder',
  SESSION_REVIEW_SUBMITTED = 'session_review_submitted',
  RESCHEDULE_REQUEST = 'reschedule_request',
  RESCHEDULE_ACCEPTED = 'reschedule_accepted',
  RESCHEDULE_DECLINED = 'reschedule_declined',
  STREAK_REMINDER = 'streak_reminder',
  STREAK_MILESTONE = 'streak_milestone',
  STREAK_FREEZE_AWARDED = 'streak_freeze_awarded',
  STREAK_FREEZE_USED = 'streak_freeze_used',
  STREAK_BROKEN = 'streak_broken',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: AppNotificationType,
    default: AppNotificationType.SYSTEM,
  })
  type!: AppNotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt?: Date;

  @Column({ type: 'json', nullable: true })
  data?: Record<string, any>;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
