import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppNotificationType {
  SESSION_REQUEST = 'session_request',
  SESSION_CONFIRMED = 'session_confirmed',
  SESSION_RESCHEDULED = 'session_rescheduled',
  SESSION_DECLINED = 'session_declined',
  SESSION_REMINDER = 'session_reminder',
  MESSAGE = 'message',
  SYSTEM = 'system',
}

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userId' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: AppNotificationType,
    default: AppNotificationType.SYSTEM,
  })
  type!: AppNotificationType;

  @Column()
  title!: string;

  @Column('text')
  message!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt?: Date;

  @Column({ type: 'json', nullable: true })
  data?: {
    sessionId?: string;
    mentorId?: string;
    menteeId?: string;
    [key: string]: any;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
