import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';

export enum MESSAGE_TYPE {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  FILE = 'file',
  SYSTEM = 'system',
  REACTION = 'reaction',
  CALL = 'call',
}

export enum MESSAGE_STATUS {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('messages')
export class Message extends BaseEntity {
  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  conversation!: Conversation;

  @Index()
  @Column({ name: 'conversationId' })
  conversationId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  sender!: User;

  @Index()
  @Column({ name: 'senderId' })
  senderId!: string;

  @Column({
    type: 'enum',
    enum: MESSAGE_TYPE,
    default: MESSAGE_TYPE.TEXT,
  })
  type!: MESSAGE_TYPE;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    mimeType?: string;
    thumbnailUrl?: string;
    dimensions?: { width: number; height: number };
    reactions?: { [userId: string]: string }; // userId -> emoji
    replyTo?: string; // messageId being replied to
    editedAt?: Date;
    originalContent?: string;
  };

  @Column({
    type: 'enum',
    enum: MESSAGE_STATUS,
    default: MESSAGE_STATUS.SENT,
  })
  status!: MESSAGE_STATUS;

  @Column({
    name: 'sentAt',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  sentAt!: Date;

  @Column({ name: 'deliveredAt', type: 'datetime', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'readAt', type: 'datetime', nullable: true })
  readAt?: Date;

  @Column({ name: 'editedAt', type: 'datetime', nullable: true })
  editedAt?: Date;

  @Column({ name: 'deletedAt', type: 'datetime', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'isPinned', type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ name: 'pinnedAt', type: 'datetime', nullable: true })
  pinnedAt?: Date;

  // Helper methods
  isRead(): boolean {
    return this.readAt !== null;
  }

  isDelivered(): boolean {
    return this.deliveredAt !== null;
  }

  isEdited(): boolean {
    return this.editedAt !== null;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  getReactionCount(): number {
    return this.metadata?.reactions
      ? Object.keys(this.metadata.reactions).length
      : 0;
  }

  getUserReaction(userId: string): string | null {
    return this.metadata?.reactions?.[userId] || null;
  }
}
