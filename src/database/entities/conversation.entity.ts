import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Message } from './message.entity';
import { ConversationParticipant } from './conversationParticipant.entity';

export enum CONVERSATION_TYPE {
  MENTOR_MENTEE = 'mentor_mentee',
  GROUP = 'group',
  SUPPORT = 'support',
}

export enum CONVERSATION_STATUS {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

@Entity('conversations')
export class Conversation extends BaseEntity {
  @Column({
    type: 'enum',
    enum: CONVERSATION_TYPE,
    default: CONVERSATION_TYPE.MENTOR_MENTEE,
  })
  type!: CONVERSATION_TYPE;

  @Column({
    type: 'enum',
    enum: CONVERSATION_STATUS,
    default: CONVERSATION_STATUS.ACTIVE,
  })
  status!: CONVERSATION_STATUS;

  @Column({ name: 'title', nullable: true })
  title?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'lastMessageId', nullable: true })
  lastMessageId?: string;

  @Column({ name: 'lastMessageAt', type: 'datetime', nullable: true })
  lastMessageAt?: Date;

  @Column({ name: 'lastMessagePreview', type: 'text', nullable: true })
  lastMessagePreview?: string;

  // Relationships
  @OneToMany(() => Message, (message) => message.conversation)
  messages!: Message[];

  @OneToMany(
    () => ConversationParticipant,
    (participant) => participant.conversation
  )
  participants!: ConversationParticipant[];

  // Helper methods
  getParticipantCount(): number {
    return this.participants ? this.participants.length : 0;
  }

  isActive(): boolean {
    return this.status === CONVERSATION_STATUS.ACTIVE;
  }
}
