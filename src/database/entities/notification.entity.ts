import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export enum NotificationType {
  SYSTEM = 'system',
  USER_ACTION = 'user_action',
  ERROR = 'error',
  MESSAGE = 'message',
}

export enum NotificationChannel {
  EMAIL = 'email',
  IN_APP = 'in_app',
  PUSH = 'push',
}

export enum UserType {
  User = 'User',
  USER = 'user',
  ADMIN = 'admin',
  STAFF = 'staff',
  STATION_USER = 'station_user',
}

export enum UserNotificationCategory {
  BONUS = 'bonus',
  REFERRAL = 'referral',
  TRANSACTION = 'transaction',
  NOTIFICATION = 'notification',
}
export interface INotification {
  id: string;
  type: NotificationType;
  channels: NotificationChannel[];
  title: string;
  message: string;
  isRead: boolean;
  sent: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

@Entity('user_notifications')
export class UserNotification extends BaseEntity implements INotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type!: NotificationType;

  @Column('simple-array')
  channels!: NotificationChannel[];

  @Column()
  title!: string;

  @Column('text')
  message!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ default: false })
  sent!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, any>;

  @Column()
  stationuserId!: string;

  @Column({ nullable: true })
  stationId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date;
}
