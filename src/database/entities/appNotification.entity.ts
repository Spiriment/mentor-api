import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
<<<<<<< HEAD
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppNotificationType {
=======
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum AppNotificationType {
  MENTORSHIP_REQUEST = 'mentorship_request',
  MENTORSHIP_ACCEPTED = 'mentorship_accepted',
  MENTORSHIP_DECLINED = 'mentorship_declined',
>>>>>>> staging
  SESSION_REQUEST = 'session_request',
  SESSION_CONFIRMED = 'session_confirmed',
  SESSION_RESCHEDULED = 'session_rescheduled',
  SESSION_DECLINED = 'session_declined',
  SESSION_REMINDER = 'session_reminder',
<<<<<<< HEAD
=======
  SESSION_REVIEW_SUBMITTED = 'session_review_submitted',
  RESCHEDULE_REQUEST = 'reschedule_request',
  RESCHEDULE_ACCEPTED = 'reschedule_accepted',
  RESCHEDULE_DECLINED = 'reschedule_declined',
  GROUP_SESSION_INVITATION = 'group_session_invitation',
  GROUP_SESSION_RESPONSE = 'group_session_response',
  GROUP_SESSION_REMINDER = 'group_session_reminder',
  GROUP_SESSION_CANCELLED = 'group_session_cancelled',
  STREAK_REMINDER = 'streak_reminder',
  STREAK_MILESTONE = 'streak_milestone',
  STREAK_FREEZE_AWARDED = 'streak_freeze_awarded',
  STREAK_FREEZE_USED = 'streak_freeze_used',
  STREAK_BROKEN = 'streak_broken',
>>>>>>> staging
  MESSAGE = 'message',
  SYSTEM = 'system',
}

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

<<<<<<< HEAD
  @Column({ name: 'userId' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: AppNotificationType,
=======
  @Column({
    type: 'varchar',
    length: 50,
>>>>>>> staging
    default: AppNotificationType.SYSTEM,
  })
  type!: AppNotificationType;

<<<<<<< HEAD
  @Column()
  title!: string;

  @Column('text')
=======
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
>>>>>>> staging
  message!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt?: Date;

  @Column({ type: 'json', nullable: true })
<<<<<<< HEAD
  data?: {
    sessionId?: string;
    mentorId?: string;
    menteeId?: string;
    [key: string]: any;
  };
=======
  data?: Record<string, any>;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
>>>>>>> staging

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
