import { DataSource, Repository, In } from 'typeorm';
import { logger } from '@/config/int-services';
import {
  User,
  Conversation,
  Message,
  ConversationParticipant,
  CONVERSATION_TYPE,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  PARTICIPANT_ROLE,
  PARTICIPANT_STATUS,
  MentorProfile,
  MenteeProfile,
} from '@/database/entities';

export interface CreateConversationData {
  type?: CONVERSATION_TYPE;
  title?: string;
  description?: string;
  participantIds: string[];
  createdBy: string;
}

export interface CreateMessageData {
  conversationId: string;
  senderId: string;
  content: string;
  type?: MESSAGE_TYPE;
  metadata?: any;
}

export interface UpdateParticipantData {
  isOnline?: boolean;
  lastSeen?: Date;
  isTyping?: boolean;
  typingAt?: Date;
}

export class ChatService {
  private dataSource: DataSource;
  private userRepository: Repository<User>;
  private conversationRepository: Repository<Conversation>;
  private messageRepository: Repository<Message>;
  private participantRepository: Repository<ConversationParticipant>;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.userRepository = dataSource.getRepository(User);
    this.conversationRepository = dataSource.getRepository(Conversation);
    this.messageRepository = dataSource.getRepository(Message);
    this.participantRepository = dataSource.getRepository(
      ConversationParticipant
    );
  }

  // Conversation Management
  async createConversation(
    data: CreateConversationData
  ): Promise<Conversation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create conversation - use queryRunner.manager.create() when in a transaction
      const conversation = queryRunner.manager.create(Conversation, {
        type: data.type || CONVERSATION_TYPE.MENTOR_MENTEE,
        title: data.title,
        description: data.description,
      });

      const savedConversation = await queryRunner.manager.save(Conversation, conversation);

      // Add participants - use queryRunner.manager.create() when in a transaction
      const participants = data.participantIds.map((userId) => {
        return queryRunner.manager.create(ConversationParticipant, {
          conversationId: savedConversation.id,
          userId,
          role: this.determineParticipantRole(userId, data.createdBy),
          status: PARTICIPANT_STATUS.ACTIVE,
        });
      });

      await queryRunner.manager.save(ConversationParticipant, participants);

      await queryRunner.commitTransaction();

      // Load full conversation with participants
      const fullConversation = await this.conversationRepository.findOne({
        where: { id: savedConversation.id },
        relations: ['participants', 'participants.user'],
      });

      logger.info(
        `Conversation ${savedConversation.id} created with ${participants.length} participants`
      );
      return fullConversation!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error('Error creating conversation:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getConversationById(
    conversationId: string
  ): Promise<Conversation | null> {
    return await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participants', 'participants.user', 'messages'],
    });
  }

  async getUserConversations(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<Conversation[]> {
    // First, find conversation IDs where the user is a participant
    const userParticipantQuery = this.participantRepository
      .createQueryBuilder('participant')
      .select('participant.conversationId')
      .where('participant.userId = :userId', { userId })
      .andWhere('participant.status = :status', {
        status: PARTICIPANT_STATUS.ACTIVE,
      });

    // Then, get all conversations with ALL their participants
    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('conversation.messages', 'message')
      .where('conversation.id IN (' + userParticipantQuery.getQuery() + ')')
      .setParameters(userParticipantQuery.getParameters())
      .andWhere('conversation.status = :conversationStatus', {
        conversationStatus: 'active',
      })
      .orderBy('conversation.lastMessageAt', 'DESC')
      .addOrderBy('message.sentAt', 'DESC')
      .limit(limit)
      .offset(offset);

    const conversations = await queryBuilder.getMany();

    // Collect all user IDs and their roles
    const userIds = new Set<string>();
    const userRoleMap = new Map<string, 'mentor' | 'mentee'>();
    
    for (const conversation of conversations) {
      if (conversation.participants) {
        for (const participant of conversation.participants) {
          if (participant.user) {
            userIds.add(participant.user.id);
            if (participant.user.role) {
              userRoleMap.set(participant.user.id, participant.user.role as 'mentor' | 'mentee');
            }
          }
        }
      }
    }

    // Batch load all profile images
    const userIdsArray = Array.from(userIds);
    if (userIdsArray.length > 0) {
      const mentorUserIds = userIdsArray.filter(id => userRoleMap.get(id) === 'mentor');
      const menteeUserIds = userIdsArray.filter(id => userRoleMap.get(id) === 'mentee');

      const [mentorProfiles, menteeProfiles] = await Promise.all([
        mentorUserIds.length > 0
          ? this.dataSource.getRepository(MentorProfile).find({
              where: { userId: In(mentorUserIds) },
              select: ['userId', 'profileImage'],
            })
          : [],
        menteeUserIds.length > 0
          ? this.dataSource.getRepository(MenteeProfile).find({
              where: { userId: In(menteeUserIds) },
              select: ['userId', 'profileImage'],
            })
          : [],
      ]);

      // Create maps for quick lookup
      const mentorProfileMap = new Map(
        mentorProfiles.map(p => [p.userId, p.profileImage])
      );
      const menteeProfileMap = new Map(
        menteeProfiles.map(p => [p.userId, p.profileImage])
      );

      // Enrich participants with profile images
      for (const conversation of conversations) {
        if (conversation.participants) {
          for (const participant of conversation.participants) {
            if (participant.user) {
              const profileImage =
                mentorProfileMap.get(participant.user.id) ||
                menteeProfileMap.get(participant.user.id);
              if (profileImage) {
                (participant.user as any).profileImage = profileImage;
              }
            }
          }
        }
      }
    }

    return conversations;
  }

  async isUserParticipant(
    userId: string,
    conversationId: string
  ): Promise<boolean> {
    const participant = await this.participantRepository.findOne({
      where: {
        userId,
        conversationId,
        status: PARTICIPANT_STATUS.ACTIVE,
      },
    });
    return !!participant;
  }

  async getConversationParticipants(
    conversationId: string
  ): Promise<ConversationParticipant[]> {
    return await this.participantRepository.find({
      where: {
        conversationId,
        status: PARTICIPANT_STATUS.ACTIVE,
      },
      relations: ['user'],
    });
  }

  // Message Management
  async createMessage(data: CreateMessageData): Promise<Message> {
    const message = this.messageRepository.create({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      type: data.type || MESSAGE_TYPE.TEXT,
      metadata: data.metadata,
      status: MESSAGE_STATUS.SENT,
      sentAt: new Date(),
    });

    const savedMessage = await this.messageRepository.save(message);

    // Load message with sender information
    const fullMessage = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender', 'conversation'],
    });

    logger.info(
      `Message ${savedMessage.id} created in conversation ${data.conversationId}`
    );
    return fullMessage!;
  }

  async createCallLog(data: {
    conversationId: string;
    senderId: string;
    callStatus: 'completed' | 'missed' | 'rejected' | 'failed';
    duration?: number;
  }): Promise<Message> {
    const content = this.formatCallLogContent(data.callStatus, data.duration);
    
    return this.createMessage({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content,
      type: MESSAGE_TYPE.CALL,
      metadata: {
        callStatus: data.callStatus,
        duration: data.duration,
      },
    });
  }

  private formatCallLogContent(status: string, duration?: number): string {
    switch (status) {
      case 'completed':
        return `Video call ended - ${this.formatDuration(duration || 0)}`;
      case 'missed':
        return 'Missed video call';
      case 'rejected':
        return 'Video call declined';
      case 'failed':
        return 'Video call failed';
      default:
        return 'Video call';
    }
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async getConversationMessages(
    conversationId: string,
    limit = 50,
    offset = 0,
    beforeMessageId?: string
  ): Promise<Message[]> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.conversationId = :conversationId', { conversationId })
      .orderBy('message.sentAt', 'DESC');

    if (beforeMessageId) {
      const beforeMessage = await this.messageRepository.findOne({
        where: { id: beforeMessageId },
      });
      if (beforeMessage) {
        queryBuilder.andWhere('message.sentAt < :beforeSentAt', {
          beforeSentAt: beforeMessage.sentAt,
        });
      }
    }

    return await queryBuilder.limit(limit).offset(offset).getMany();
  }

  async getMessageById(messageId: string): Promise<Message | null> {
    return await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation', 'sender'],
    });
  }

  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    await this.messageRepository.update(
      { id: messageId },
      {
        status: MESSAGE_STATUS.READ,
        readAt: new Date(),
      }
    );
  }

  async markMessageAsDelivered(messageId: string): Promise<void> {
    await this.messageRepository.update(
      { id: messageId },
      {
        status: MESSAGE_STATUS.DELIVERED,
        deliveredAt: new Date(),
      }
    );
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<void> {
    // Mark all unread messages in conversation as read
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({
        status: MESSAGE_STATUS.READ,
        readAt: new Date(),
      })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderId != :userId', { userId })
      .andWhere('status != :readStatus', { readStatus: MESSAGE_STATUS.READ })
      .execute();

    // Update participant's last read message
    const lastMessage = await this.messageRepository.findOne({
      where: { conversationId },
      order: { sentAt: 'DESC' },
    });

    if (lastMessage) {
      await this.participantRepository.update(
        { userId, conversationId },
        {
          lastReadMessageId: lastMessage.id,
          lastReadAt: new Date(),
        }
      );
    }
  }

  async updateConversationLastMessage(
    conversationId: string,
    message: Message
  ): Promise<void> {
    await this.conversationRepository.update(conversationId, {
      lastMessageId: message.id,
      lastMessageAt: message.sentAt,
      lastMessagePreview: message.content.substring(0, 100),
    });
  }

  // Participant Management
  async updateParticipantStatus(
    userId: string,
    conversationId: string,
    data: UpdateParticipantData
  ): Promise<void> {
    const updateData: any = {};

    if (data.isOnline !== undefined) {
      updateData.isOnline = data.isOnline;
    }
    if (data.lastSeen !== undefined) {
      updateData.lastSeen = data.lastSeen;
    }
    if (data.isTyping !== undefined) {
      updateData.isTyping = data.isTyping;
      updateData.typingAt = data.typingAt || new Date();
    }

    // Only update if there's something to update
    if (Object.keys(updateData).length > 0) {
      await this.participantRepository.update(
        { userId, conversationId },
        updateData
      );
    }
  }

  // Reaction Management
  async addReactionToMessage(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new Error('Message not found');

    const metadata = message.metadata || {};
    const reactions = metadata.reactions || {};
    reactions[userId] = emoji;
    metadata.reactions = reactions;

    await this.messageRepository.update(messageId, { metadata });
  }

  async removeReactionFromMessage(
    messageId: string,
    userId: string
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new Error('Message not found');

    const metadata = message.metadata || {};
    const reactions = metadata.reactions || {};
    delete reactions[userId];
    metadata.reactions = reactions;

    await this.messageRepository.update(messageId, { metadata });
  }

  async deleteMessage(
    messageId: string,
    userId: string,
    deleteType: 'me' | 'everyone'
  ): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) throw new Error('Message not found');

    if (deleteType === 'everyone') {
      // Verify user is the sender
      if (message.senderId !== userId) {
        throw new Error('Not authorized to delete this message for everyone');
      }

      // Mark as deleted for everyone
      await this.messageRepository.update(messageId, {
        deletedAt: new Date(),
        content: 'This message was deleted',
      });
    } else {
      // For 'me', we'll treat it as a soft delete IF it's the sender, 
      // or just mark as deleted without changing content.
      if (message.senderId === userId) {
        await this.messageRepository.update(messageId, {
          deletedAt: new Date(),
        });
      }
    }
  }

  async editMessage(
    messageId: string,
    userId: string,
    newContent: string
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('You can only edit your own messages');
    }

    if (message.deletedAt) {
      throw new Error('Cannot edit a deleted message');
    }

    // Enforce 15-minute edit limit
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.sentAt < fifteenMinutesAgo) {
      throw new Error('Messages can only be edited within 15 minutes of sending');
    }

    message.content = newContent;
    message.editedAt = new Date();
    
    return await this.messageRepository.save(message);
  }

  async pinMessage(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user is a participant
    const isParticipant = await this.isUserParticipant(
      userId,
      message.conversationId
    );
    if (!isParticipant) {
      throw new Error('Not authorized to pin messages in this conversation');
    }

    // For simplicity, we'll unpin any existing pinned messages in this conversation
    // (Optional: support multiple pins later)
    await this.messageRepository.update(
      { conversationId: message.conversationId, isPinned: true },
      { isPinned: false, pinnedAt: undefined }
    );

    message.isPinned = true;
    message.pinnedAt = new Date();

    return await this.messageRepository.save(message);
  }

  async unpinMessage(messageId: string, userId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user is a participant
    const isParticipant = await this.isUserParticipant(
      userId,
      message.conversationId
    );
    if (!isParticipant) {
      throw new Error('Not authorized to unpin messages in this conversation');
    }

    message.isPinned = false;
    message.pinnedAt = undefined;

    return await this.messageRepository.save(message);
  }

  // Helper methods
  private determineParticipantRole(
    userId: string,
    createdBy: string
  ): PARTICIPANT_ROLE {
    // This is a simple implementation - you might want to check user roles from database
    return userId === createdBy
      ? PARTICIPANT_ROLE.MENTOR
      : PARTICIPANT_ROLE.MENTEE;
  }

  public getUserRepository(): Repository<User> {
    return this.userRepository;
  }

  public getConversationRepository(): Repository<Conversation> {
    return this.conversationRepository;
  }

  public getMessageRepository(): Repository<Message> {
    return this.messageRepository;
  }

  public getParticipantRepository(): Repository<ConversationParticipant> {
    return this.participantRepository;
  }
}
