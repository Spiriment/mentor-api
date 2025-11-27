import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum SESSION_STATUS {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum SESSION_TYPE {
  ONE_ON_ONE = 'one_on_one',
  GROUP = 'group',
  VIDEO_CALL = 'video_call',
  PHONE_CALL = 'phone_call',
  IN_PERSON = 'in_person',
}

export enum SESSION_DURATION {
  THIRTY_MINUTES = 30,
  ONE_HOUR = 60,
  NINETY_MINUTES = 90,
  TWO_HOURS = 120,
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentorId' })
  mentor!: User;

  @Column()
  mentorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menteeId' })
  mentee!: User;

  @Column()
  menteeId!: string;

  @Column({
    type: 'enum',
    enum: SESSION_STATUS,
    default: SESSION_STATUS.SCHEDULED,
  })
  status!: SESSION_STATUS;

  @Column({
    type: 'enum',
    enum: SESSION_TYPE,
    default: SESSION_TYPE.ONE_ON_ONE,
  })
  type!: SESSION_TYPE;

  @Column({
    type: 'enum',
    enum: SESSION_DURATION,
    default: SESSION_DURATION.ONE_HOUR,
  })
  duration!: SESSION_DURATION;

  @Column({ type: 'datetime' })
  scheduledAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt?: Date;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  meetingLink?: string;

  @Column({ type: 'text', nullable: true })
  meetingId?: string;

  @Column({ type: 'text', nullable: true })
  meetingPassword?: string;

  @Column({ type: 'text', nullable: true })
  location?: string;

  @Column({ type: 'text', nullable: true })
  mentorNotes?: string;

  @Column({ type: 'text', nullable: true })
  menteeNotes?: string;

  @Column({ type: 'text', nullable: true })
  sessionNotes?: string;

  @Column({ type: 'json', nullable: true })
  feedback?: {
    mentorRating?: number;
    menteeRating?: number;
    mentorFeedback?: string;
    menteeFeedback?: string;
    topics?: string[];
    nextSteps?: string;
  };

  @Column({ type: 'json', nullable: true })
  reminders?: {
    sent24h?: boolean;
    sent1h?: boolean;
    sent15min?: boolean;
  };

  @Column({ default: false })
  isRecurring!: boolean;

  @Column({ nullable: true })
  recurringPattern?: string; // 'weekly', 'biweekly', 'monthly'

  @Column({ nullable: true })
  parentSessionId?: string; // For recurring sessions

  @Column({ type: 'datetime', nullable: true })
  cancelledAt?: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason?: string;

  @Column({ default: false })
  menteeConfirmed!: boolean;

  @Column({ default: false })
  mentorConfirmed!: boolean;

  @Column({ type: 'datetime', nullable: true, select: false })
  previousScheduledAt?: Date;

  @Column({ type: 'datetime', nullable: true, select: false })
  rescheduleRequestedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  requestedScheduledAt?: Date;

  @Column({ type: 'text', nullable: true, select: false })
  rescheduleReason?: string;

  @Column({ type: 'text', nullable: true, select: false })
  rescheduleMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
