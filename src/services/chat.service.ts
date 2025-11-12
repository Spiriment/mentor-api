import { DataSource, Repository } from 'typeorm';
import { logger } from '@/config/int-services';
import {
  User,
  Conversation,
  Message,
  ConversationParticipant,
  MentorProfile,
  MenteeProfile,
  CONVERSATION_TYPE,
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  PARTICIPANT_ROLE,
  PARTICIPANT_STATUS,
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
  // Note: isOnline and lastSeen are not fields in ConversationParticipant entity
  // Online status should be tracked separately if needed
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
      // Create conversation
      const conversation = this.conversationRepository.create({
        type: data.type || CONVERSATION_TYPE.MENTOR_MENTEE,
        title: data.title,
        description: data.description,
      });

      const savedConversation = await queryRunner.manager.save(conversation);

      // Filter out any invalid participant IDs before creating participants
      const validParticipantIds = (data.participantIds || []).filter(
        (id) => id != null && id !== undefined && id !== '' && typeof id === 'string'
      );

      if (validParticipantIds.length === 0) {
        throw new Error('No valid participant IDs provided');
      }

      // Add participants
      const participants = validParticipantIds.map((userId) => {
        if (!userId || typeof userId !== 'string') {
          throw new Error(`Invalid participant ID: ${userId}`);
        }
        
        const participant = this.participantRepository.create({
          conversationId: savedConversation.id,
          userId: userId,
          role: this.determineParticipantRole(userId, data.createdBy),
          status: PARTICIPANT_STATUS.ACTIVE,
        });
        return participant;
      });

      await queryRunner.manager.save(participants);

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

    // Then, load all conversations with ALL their participants
    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'user')
      .leftJoinAndSelect('conversation.messages', 'message')
      .where(`conversation.id IN (${userParticipantQuery.getQuery()})`)
      .setParameters(userParticipantQuery.getParameters())
      .andWhere('conversation.status = :conversationStatus', {
        conversationStatus: 'active',
      })
      .orderBy('conversation.lastMessageAt', 'DESC')
      .addOrderBy('message.sentAt', 'DESC')
      .limit(limit)
      .offset(offset);

    const conversations = await queryBuilder.getMany();
    
    // Enrich user data with profileImage from profile entities
    // Since User doesn't have reverse relations to profiles, we need to fetch them separately
    const mentorProfileRepository = this.dataSource.getRepository(MentorProfile);
    const menteeProfileRepository = this.dataSource.getRepository(MenteeProfile);
    
    // Collect all unique user IDs to fetch profiles in batch
    const userIds = new Set<string>();
    conversations.forEach((conversation) => {
      conversation.participants?.forEach((participant) => {
        if (participant.user?.id) {
          userIds.add(participant.user.id);
        }
      });
    });
    
    // Fetch all profiles in parallel
    const [mentorProfiles, menteeProfiles] = await Promise.all([
      mentorProfileRepository.find({
        where: Array.from(userIds).map((id) => ({ userId: id })),
        select: ['userId', 'profileImage'],
      }),
      menteeProfileRepository.find({
        where: Array.from(userIds).map((id) => ({ userId: id })),
        select: ['userId', 'profileImage'],
      }),
    ]);
    
    // Create maps for quick lookup
    const mentorProfileMap = new Map(
      mentorProfiles.map((p) => [p.userId, p.profileImage])
    );
    const menteeProfileMap = new Map(
      menteeProfiles.map((p) => [p.userId, p.profileImage])
    );
    
    // Enrich user data with profileImage
    conversations.forEach((conversation) => {
      conversation.participants?.forEach((participant) => {
        if (participant.user) {
          const user = participant.user as any;
          // Try mentor profile first, then mentee profile
          user.profileImage =
            mentorProfileMap.get(user.id) || menteeProfileMap.get(user.id) || undefined;
        }
      });
    });

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
      .andWhere('message.deletedAt IS NULL')
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

    // Note: isOnline and lastSeen are not fields in ConversationParticipant entity
    // Online status should be tracked separately if needed (e.g., in User entity or separate table)
    
    if (data.isTyping !== undefined) {
      updateData.isTyping = data.isTyping;
      updateData.typingAt = data.typingAt || new Date();
    }

    // Only update if there's data to update
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
