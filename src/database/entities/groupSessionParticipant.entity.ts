import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { GroupSession } from './groupSession.entity';

export enum INVITATION_STATUS {
  INVITED = 'invited',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  NO_RESPONSE = 'no_response',
}

@Entity('group_session_participants')
@Unique(['groupSessionId', 'menteeId']) // Ensure mentee can only be invited once per session
export class GroupSessionParticipant extends BaseEntity {
  @ManyToOne(() => GroupSession, (session) => session.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'groupSessionId' })
  groupSession!: GroupSession;

  @Index()
  @Column({ name: 'groupSessionId' })
  groupSessionId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menteeId' })
  mentee!: User;

  @Index()
  @Column({ name: 'menteeId' })
  menteeId!: string;

  @Column({
    type: 'enum',
    enum: INVITATION_STATUS,
    default: INVITATION_STATUS.INVITED,
    name: 'invitationStatus',
  })
  invitationStatus!: INVITATION_STATUS;

  @Column({ type: 'datetime', name: 'invitedAt' })
  invitedAt!: Date;

  @Column({ type: 'datetime', nullable: true, name: 'respondedAt' })
  respondedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'declineReason' })
  declineReason?: string;

  @Column({ type: 'text', nullable: true, name: 'sessionSummary' })
  sessionSummary?: string;

  @Column({ type: 'datetime', nullable: true, name: 'summarySubmittedAt' })
  summarySubmittedAt?: Date;

  @Column({ type: 'boolean', default: false, name: 'hasSubmittedReview' })
  hasSubmittedReview!: boolean;

  // Helper methods
  hasResponded(): boolean {
    return this.respondedAt !== null && this.respondedAt !== undefined;
  }

  hasAccepted(): boolean {
    return this.invitationStatus === INVITATION_STATUS.ACCEPTED;
  }

  hasDeclined(): boolean {
    return this.invitationStatus === INVITATION_STATUS.DECLINED;
  }

  isPending(): boolean {
    return this.invitationStatus === INVITATION_STATUS.INVITED;
  }

  canRespond(sessionScheduledAt: Date): boolean {
    // Can respond until 2 hours before session
    const twoHoursBefore = new Date(sessionScheduledAt);
    twoHoursBefore.setHours(twoHoursBefore.getHours() - 2);
    return new Date() < twoHoursBefore && this.isPending();
  }
}
