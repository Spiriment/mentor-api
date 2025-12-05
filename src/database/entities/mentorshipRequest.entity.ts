import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum MENTORSHIP_REQUEST_STATUS {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
}

@Entity('mentorship_requests')
@Index(['mentorId', 'menteeId'], { unique: true })
export class MentorshipRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  mentorId: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  menteeId: string;

  @Column({
    type: 'enum',
    enum: MENTORSHIP_REQUEST_STATUS,
    default: MENTORSHIP_REQUEST_STATUS.PENDING,
  })
  status: MENTORSHIP_REQUEST_STATUS;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'text', nullable: true })
  responseMessage?: string;

  @Column({ type: 'datetime', nullable: true })
  respondedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentorId' })
  mentor?: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menteeId' })
  mentee?: User;

  // Helper methods
  isPending(): boolean {
    return this.status === MENTORSHIP_REQUEST_STATUS.PENDING;
  }

  isAccepted(): boolean {
    return this.status === MENTORSHIP_REQUEST_STATUS.ACCEPTED;
  }

  isDeclined(): boolean {
    return this.status === MENTORSHIP_REQUEST_STATUS.DECLINED;
  }

  isCancelled(): boolean {
    return this.status === MENTORSHIP_REQUEST_STATUS.CANCELLED;
  }

  canRespond(): boolean {
    return this.status === MENTORSHIP_REQUEST_STATUS.PENDING;
  }

  canCancel(): boolean {
    return this.status === MENTORSHIP_REQUEST_STATUS.PENDING;
  }
}
