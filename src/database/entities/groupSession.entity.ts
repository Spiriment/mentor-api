import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GroupSessionParticipant } from './groupSessionParticipant.entity';

export enum GROUP_SESSION_STATUS {
  DRAFT = 'draft',
  INVITES_SENT = 'invites_sent',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  MISSED = 'missed',
}

export enum GROUP_SESSION_DURATION {
  THIRTY_MINUTES = 30,
  ONE_HOUR = 60,
  NINETY_MINUTES = 90,
  TWO_HOURS = 120,
}

@Entity('group_sessions')
export class GroupSession extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentorId' })
  mentor!: User;

  @Index()
  @Column({ name: 'mentorId' })
  mentorId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Index()
  @Column({ type: 'datetime', name: 'scheduledAt' })
  scheduledAt!: Date;

  @Column({
    type: 'enum',
    enum: GROUP_SESSION_DURATION,
    default: GROUP_SESSION_DURATION.ONE_HOUR,
  })
  duration!: GROUP_SESSION_DURATION;

  @Column({ type: 'int', default: 5, name: 'maxParticipants' })
  maxParticipants!: number;

  @Column({
    type: 'enum',
    enum: GROUP_SESSION_STATUS,
    default: GROUP_SESSION_STATUS.DRAFT,
  })
  status!: GROUP_SESSION_STATUS;

  @Column({ type: 'text', nullable: true, name: 'meetingLink' })
  meetingLink?: string;

  @Column({ type: 'text', nullable: true, name: 'meetingId' })
  meetingId?: string;

  @Column({ type: 'text', nullable: true, name: 'meetingPassword' })
  meetingPassword?: string;

  @Column({ type: 'datetime', nullable: true, name: 'startedAt' })
  startedAt?: Date;

  @Column({ type: 'datetime', nullable: true, name: 'endedAt' })
  endedAt?: Date;

  @Column({ type: 'datetime', nullable: true, name: 'cancelledAt' })
  cancelledAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'cancellationReason' })
  cancellationReason?: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'conversationId' })
  conversationId?: string;

  @Column({ type: 'json', nullable: true })
  reminders?: {
    sent24h?: boolean;
    sent1h?: boolean;
    sent15min?: boolean;
  };

  // Relationships
  @OneToMany(
    () => GroupSessionParticipant,
    (participant) => participant.groupSession,
    { cascade: true }
  )
  participants!: GroupSessionParticipant[];

  // Helper methods
  getAcceptedCount(): number {
    return this.participants?.filter((p) => p.invitationStatus === 'accepted')
      .length || 0;
  }

  getDeclinedCount(): number {
    return this.participants?.filter((p) => p.invitationStatus === 'declined')
      .length || 0;
  }

  getPendingCount(): number {
    return this.participants?.filter((p) => p.invitationStatus === 'invited')
      .length || 0;
  }

  hasMinimumParticipants(): boolean {
    return this.getAcceptedCount() >= 2;
  }

  canStart(): boolean {
    return (
      this.status === GROUP_SESSION_STATUS.CONFIRMED &&
      this.hasMinimumParticipants()
    );
  }

  isUpcoming(): boolean {
    return new Date(this.scheduledAt) > new Date();
  }

  isPast(): boolean {
    return new Date(this.scheduledAt) < new Date();
  }
}
