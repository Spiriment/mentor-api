import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import jwt from 'jsonwebtoken';
import { Config } from '@/config';
import { logger } from '@/config/int-services';
import { User } from '@/database/entities';
import { ChatService } from '@/services/chat.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: User;
}

interface SocketEvents {
  // Connection events
  connect: () => void;
  disconnect: () => void;

  // Conversation events
  'join-conversation': (conversationId: string) => void;
  'leave-conversation': (conversationId: string) => void;

  // Message events
  'send-message': (data: {
    conversationId: string;
    content: string;
    type?: string;
    metadata?: any;
  }) => void;

  'typing-start': (conversationId: string) => void;
  'typing-stop': (conversationId: string) => void;

  // Read receipt events
  'mark-message-read': (messageId: string) => void;
  'mark-conversation-read': (conversationId: string) => void;

  // Reaction events
  'add-reaction': (data: { messageId: string; emoji: string }) => void;
  'remove-reaction': (messageId: string) => void;
}

export class WebSocketService {
  private io: SocketIOServer;
  private chatService: ChatService;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HttpServer, dataSource: DataSource) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.chatService = new ChatService(dataSource);
    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket service initialized');
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, Config.jwt.privateKey) as any;
        socket.userId = decoded.userId;

        // Optionally fetch full user data
        const userRepository = this.chatService.getUserRepository();
        const user = await userRepository.findOne({
          where: { id: decoded.userId },
          select: ['id', 'email', 'firstName', 'lastName', 'role'],
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.user = user as User;

        logger.info(`User ${socket.user.email} connected via WebSocket`);
        next();
      } catch (error: any) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    const user = socket.user!;

    // Store user connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room for notifications
    socket.join(`user:${userId}`);

    logger.info(`User ${user.email} connected (socket: ${socket.id})`);

    // Handle conversation joining
    socket.on('join-conversation', async (conversationId: string) => {
      await this.handleJoinConversation(socket, conversationId);
    });

    // Handle conversation leaving
    socket.on('leave-conversation', (conversationId: string) => {
      this.handleLeaveConversation(socket, conversationId);
    });

    // Handle message sending
    socket.on('send-message', async (data) => {
      await this.handleSendMessage(socket, data);
    });

    // Handle typing indicators
    socket.on('typing-start', (conversationId: string) => {
      this.handleTypingStart(socket, conversationId);
    });

    socket.on('typing-stop', (conversationId: string) => {
      this.handleTypingStop(socket, conversationId);
    });

    // Handle read receipts
    socket.on('mark-message-read', async (messageId: string) => {
      await this.handleMarkMessageRead(socket, messageId);
    });

    socket.on('mark-conversation-read', async (conversationId: string) => {
      await this.handleMarkConversationRead(socket, conversationId);
    });

    // Handle reactions
    socket.on('add-reaction', async (data) => {
      await this.handleAddReaction(socket, data);
    });

    socket.on('remove-reaction', async (messageId: string) => {
      await this.handleRemoveReaction(socket, messageId);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  private async handleJoinConversation(
    socket: AuthenticatedSocket,
    conversationId: string
  ) {
    try {
      // Verify user is participant in this conversation
      const isParticipant = await this.chatService.isUserParticipant(
        socket.userId!,
        conversationId
      );

      if (!isParticipant) {
        socket.emit('error', {
          message: 'Not authorized to join this conversation',
        });
        return;
      }

      // Join the conversation room
      socket.join(`conversation:${conversationId}`);

      // Update user's online status in conversation
      await this.chatService.updateParticipantStatus(
        socket.userId!,
        conversationId,
        {
          isOnline: true,
          lastSeen: new Date(),
        }
      );

      socket.emit('joined-conversation', { conversationId });
      logger.info(
        `User ${socket.userId} joined conversation ${conversationId}`
      );
    } catch (error: any) {
      logger.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  private handleLeaveConversation(
    socket: AuthenticatedSocket,
    conversationId: string
  ) {
    socket.leave(`conversation:${conversationId}`);
    socket.emit('left-conversation', { conversationId });
    logger.info(`User ${socket.userId} left conversation ${conversationId}`);
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId, content, type = 'text', metadata } = data;

      // Verify user is participant
      const isParticipant = await this.chatService.isUserParticipant(
        socket.userId!,
        conversationId
      );
      if (!isParticipant) {
        socket.emit('error', {
          message: 'Not authorized to send messages to this conversation',
        });
        return;
      }

      // Create message
      const message = await this.chatService.createMessage({
        conversationId,
        senderId: socket.userId!,
        content,
        type,
        metadata,
      });

      // Broadcast message to conversation participants
      this.io.to(`conversation:${conversationId}`).emit('new-message', {
        message,
        conversationId,
      });

      // Update conversation last message
      await this.chatService.updateConversationLastMessage(
        conversationId,
        message
      );

      // Send delivery confirmation to sender
      socket.emit('message-sent', {
        messageId: message.id,
        status: 'delivered',
      });

      logger.info(
        `Message sent in conversation ${conversationId} by user ${socket.userId}`
      );
    } catch (error: any) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private handleTypingStart(
    socket: AuthenticatedSocket,
    conversationId: string
  ) {
    socket.to(`conversation:${conversationId}`).emit('user-typing', {
      userId: socket.userId,
      conversationId,
      isTyping: true,
    });
  }

  private handleTypingStop(
    socket: AuthenticatedSocket,
    conversationId: string
  ) {
    socket.to(`conversation:${conversationId}`).emit('user-typing', {
      userId: socket.userId,
      conversationId,
      isTyping: false,
    });
  }

  private async handleMarkMessageRead(
    socket: AuthenticatedSocket,
    messageId: string
  ) {
    try {
      await this.chatService.markMessageAsRead(messageId, socket.userId!);

      // Notify other participants that message was read
      const message = await this.chatService.getMessageById(messageId);
      if (message) {
        socket
          .to(`conversation:${message.conversationId}`)
          .emit('message-read', {
            messageId,
            readBy: socket.userId,
            readAt: new Date(),
          });
      }
    } catch (error: any) {
      logger.error('Error marking message as read:', error);
    }
  }

  private async handleMarkConversationRead(
    socket: AuthenticatedSocket,
    conversationId: string
  ) {
    try {
      await this.chatService.markConversationAsRead(
        conversationId,
        socket.userId!
      );
      socket.emit('conversation-read', { conversationId });
    } catch (error: any) {
      logger.error('Error marking conversation as read:', error);
    }
  }

  private async handleAddReaction(socket: AuthenticatedSocket, data: any) {
    try {
      const { messageId, emoji } = data;
      await this.chatService.addReactionToMessage(
        messageId,
        socket.userId!,
        emoji
      );

      const message = await this.chatService.getMessageById(messageId);
      if (message) {
        this.io
          .to(`conversation:${message.conversationId}`)
          .emit('reaction-added', {
            messageId,
            userId: socket.userId,
            emoji,
          });
      }
    } catch (error: any) {
      logger.error('Error adding reaction:', error);
    }
  }

  private async handleRemoveReaction(
    socket: AuthenticatedSocket,
    messageId: string
  ) {
    try {
      await this.chatService.removeReactionFromMessage(
        messageId,
        socket.userId!
      );

      const message = await this.chatService.getMessageById(messageId);
      if (message) {
        this.io
          .to(`conversation:${message.conversationId}`)
          .emit('reaction-removed', {
            messageId,
            userId: socket.userId,
          });
      }
    } catch (error: any) {
      logger.error('Error removing reaction:', error);
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    this.connectedUsers.delete(userId);

    logger.info(`User ${userId} disconnected (socket: ${socket.id})`);
  }

  // Public methods for external use
  public getIO(): SocketIOServer {
    return this.io;
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public sendNotificationToUser(userId: string, notification: any) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  public sendNotificationToConversation(
    conversationId: string,
    notification: any
  ) {
    this.io
      .to(`conversation:${conversationId}`)
      .emit('conversation-notification', notification);
  }
}
