import { Entity, Column, ManyToOne, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';

export enum PARTICIPANT_ROLE {
  MENTOR = 'mentor',
  MENTEE = 'mentee',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum PARTICIPANT_STATUS {
  ACTIVE = 'active',
  MUTED = 'muted',
  LEFT = 'left',
  REMOVED = 'removed',
}

@Entity('conversation_participants')
@Unique(['conversationId', 'userId']) // Ensure user can only be in conversation once
export class ConversationParticipant extends BaseEntity {
  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  conversation!: Conversation;

  @Index()
  @Column({ name: 'conversationId' })
  conversationId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Index()
  @Column({ name: 'userId' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: PARTICIPANT_ROLE,
    default: PARTICIPANT_ROLE.MENTEE,
  })
  role!: PARTICIPANT_ROLE;

  @Column({
    type: 'enum',
    enum: PARTICIPANT_STATUS,
    default: PARTICIPANT_STATUS.ACTIVE,
  })
  status!: PARTICIPANT_STATUS;

  @Column({
    name: 'joinedAt',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt!: Date;

  @Column({ name: 'leftAt', type: 'datetime', nullable: true })
  leftAt?: Date;

  @Column({ name: 'lastReadMessageId', nullable: true })
  lastReadMessageId?: string;

  @Column({ name: 'lastReadAt', type: 'datetime', nullable: true })
  lastReadAt?: Date;

  @Column({ name: 'isTyping', type: 'boolean', default: false })
  isTyping!: boolean;

  @Column({ name: 'typingAt', type: 'datetime', nullable: true })
  typingAt?: Date;

  @Column({ name: 'isOnline', type: 'boolean', default: false })
  isOnline!: boolean;

  @Column({ name: 'lastSeen', type: 'datetime', nullable: true })
  lastSeen?: Date;

  @Column({ name: 'notificationSettings', type: 'json', nullable: true })
  notificationSettings?: {
    muteConversation: boolean;
    muteUntil?: Date;
    pushNotifications: boolean;
    emailNotifications: boolean;
  };

  // Helper methods
  isActive(): boolean {
    return this.status === PARTICIPANT_STATUS.ACTIVE;
  }

  isMuted(): boolean {
    return this.status === PARTICIPANT_STATUS.MUTED;
  }

  hasLeft(): boolean {
    return this.status === PARTICIPANT_STATUS.LEFT;
  }

  wasRemoved(): boolean {
    return this.status === PARTICIPANT_STATUS.REMOVED;
  }

  isCurrentlyTyping(): boolean {
    if (!this.isTyping || !this.typingAt) return false;

    // Consider typing expired after 10 seconds of inactivity
    const tenSecondsAgo = new Date(Date.now() - 10000);
    return this.typingAt > tenSecondsAgo;
  }

  getUnreadCount(): Promise<number> {
    // This would be calculated by counting messages after lastReadMessageId
    // Implementation would be in the service layer
    return Promise.resolve(0);
  }
}
