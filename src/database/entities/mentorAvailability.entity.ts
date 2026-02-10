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

export enum DAY_OF_WEEK {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export enum AVAILABILITY_STATUS {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  BOOKED = 'booked',
}

@Entity('mentor_availability')
export class MentorAvailability {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentorId' })
  mentor!: User;

  @Column()
  mentorId!: string;

  @Column({ type: 'int' })
  dayOfWeek!: number;

  @Column({ type: 'time' })
  startTime!: string; // Format: "09:00:00"

  @Column({ type: 'time' })
  endTime!: string; // Format: "17:00:00"

  @Column({
    type: 'enum',
    enum: AVAILABILITY_STATUS,
    default: AVAILABILITY_STATUS.AVAILABLE,
  })
  status!: AVAILABILITY_STATUS;

  @Column({ type: 'json', nullable: true })
  breaks?: {
    startTime: string;
    endTime: string;
    reason?: string;
  }[];

  @Column({ type: 'int', default: 30 })
  slotDuration!: number; // Duration in minutes

  @Column({ type: 'text', nullable: true })
  timezone!: string;

  @Column({ type: 'date', nullable: true })
  specificDate?: Date; // For one-time availability overrides

  @Column({ type: 'boolean', default: true })
  isRecurring!: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
