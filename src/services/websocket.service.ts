import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import jwt from 'jsonwebtoken';
import { Config } from '@/config';
import { logger } from '@/config/int-services';
import { User } from '@/database/entities';
import { ChatService } from '@/services/chat.service';
import { pushNotificationService } from '@/services/pushNotification.service';

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

  // Call events
  'call-invite': (data: {
    sessionId?: string;
    targetUserId: string;
    callerName: string;
    callerImage?: string;
  }) => void;
  'call-accept': (data: { sessionId?: string; callerId: string }) => void;
  'call-reject': (data: { sessionId?: string; callerId: string }) => void;
  'call-end': (data: { sessionId?: string; targetUserId: string }) => void;
}

export class WebSocketService {
  private io: SocketIOServer;
  private chatService: ChatService;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HttpServer, dataSource: DataSource) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: true, // Allow all origins for mobile app compatibility
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      // Heartbeat configuration to detect stale connections
      pingInterval: 25000, // Send ping every 25 seconds
      pingTimeout: 20000, // Wait 20 seconds for pong response before considering connection dead
      upgradeTimeout: 10000, // 10 seconds to upgrade from polling to websocket
      connectTimeout: 45000, // 45 seconds for initial connection timeout
    });

    this.chatService = new ChatService(dataSource);
    this.setupMiddleware();
    this.setupEventHandlers();

    WebSocketService.instance = this;
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
          logger.error('❌ WebSocket connection attempt without token', undefined, {
            id: socket.id,
            headers: socket.handshake.headers,
            query: socket.handshake.query,
            address: socket.handshake.address
          });
          return next(new Error('Authentication token required'));
        }

        logger.debug(`🔍 WebSocket handshake attempt: ${socket.id}`, {
          tokenPreview: token.substring(0, 10) + '...',
          transport: socket.conn.transport.name,
          address: socket.handshake.address
        });

        let decoded: any;
        try {
          decoded = jwt.verify(token, Config.jwt.publicKey) as any;
        } catch (jwtError: any) {
          // Handle specific JWT errors
          if (jwtError.name === 'TokenExpiredError') {
            logger.warn('WebSocket connection attempt with expired token', {
              socketId: socket.id,
              expiredAt: jwtError.expiredAt,
            });
            return next(new Error('Token expired. Please login again.'));
          } else if (jwtError.name === 'JsonWebTokenError') {
            logger.error('WebSocket connection attempt with invalid token', jwtError, {
              socketId: socket.id,
            });
            return next(new Error('Invalid authentication token'));
          } else {
            logger.error('WebSocket JWT verification failed', jwtError, {
              socketId: socket.id,
            });
            return next(new Error('Authentication failed'));
          }
        }

        socket.userId = decoded.userId;

        // Fetch full user data
        const userRepository = this.chatService.getUserRepository();
        const user = await userRepository.findOne({
          where: { id: decoded.userId },
          select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive'],
        });

        if (!user) {
          logger.error(`WebSocket user not found for userId: ${decoded.userId}`);
          return next(new Error('User not found'));
        }

        if (!user.isActive) {
          logger.warn(`WebSocket connection attempt by inactive user: ${user.email}`);
          return next(new Error('Account is inactive'));
        }

        socket.user = user as User;

        logger.info(`✅ User ${socket.user.email} (${socket.user.id}) authenticated via WebSocket`);
        next();
      } catch (error: any) {
        logger.error(`WebSocket authentication failed: ${error.message} (${error.name})`, error);
        next(new Error(`Authentication failed: ${error.message}`));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private async handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    const user = socket.user!;

    // Store user connection
    this.connectedUsers.set(userId, socket.id);

    // Join user to their personal room for direct messages (call invites, notifications, etc.)
    socket.join(`user:${userId}`);

    logger.info(`✅ User ${user.email} connected`, {
      userId,
      socketId: socket.id,
      transport: socket.conn.transport.name,
      totalConnected: this.connectedUsers.size,
      joinedRooms: Array.from(socket.rooms)
    });

    // Listen for transport changes (e.g., polling to websocket upgrade)
    socket.conn.on('upgrade', (transport) => {
      logger.info(`🚀 Socket ${socket.id} upgraded to ${transport.name}`);
    });

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

    // Handle video calls
    socket.on('call-invite', (data: any) => {
      this.handleCallInvite(socket, data);
    });

    socket.on('call-accept', (data: any) => {
      this.handleCallAccept(socket, data);
    });

    socket.on('call-reject', (data: any) => {
      this.handleCallReject(socket, data);
    });

    socket.on('call-end', (data: any) => {
      this.handleCallEnd(socket, data);
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

  private async handleLeaveConversation(
    socket: AuthenticatedSocket,
    conversationId: string
  ) {
    socket.leave(`conversation:${conversationId}`);
    
    // Update user's online status in conversation to false
    // This means they are no longer actively viewing the chat
    await this.chatService.updateParticipantStatus(
      socket.userId!,
      conversationId,
      {
        isOnline: false,
        lastSeen: new Date(),
      }
    );

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

      // Send confirmation to sender immediately (single tick - sent)
      socket.emit('message-sent', {
        messageId: message.id,
        status: 'sent',
        sentAt: message.sentAt,
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

      // Send notifications to other participants
      const participants = await this.chatService.getConversationParticipants(conversationId);
      const sender = socket.user!;
      const senderName = `${sender.firstName} ${sender.lastName || ''}`.trim();

      for (const participant of participants) {
        // Skip sender
        if (participant.userId === socket.userId) continue;

        if (participant.isOnline) {
          // Recipient is actively viewing the conversation
          // We can mark message as delivered if at least one other participant is online
          await this.chatService.markMessageAsDelivered(message.id);

          // Notify sender that message was delivered
          socket.emit('message-delivered', {
            messageId: message.id,
            status: 'delivered',
            deliveredAt: new Date(),
          });

          // Also broadcast to conversation room
          this.io.to(`conversation:${conversationId}`).emit('message-delivered', {
            messageId: message.id,
            deliveredAt: new Date(),
          });
        } else {
          // Recipient is NOT viewing the conversation (might be elsewhere in app or offline)
          // Send push notification if they have a token
          if (participant.user?.pushToken) {
            await pushNotificationService.sendNewMessageNotification(
              participant.user.pushToken,
              participant.userId,
              senderName,
              content
            );
          }
        }
      }

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

      // Notify the reader (current socket)
      socket.emit('conversation-read', { conversationId });

      // Notify other participants that their messages in this conversation were read
      socket.to(`conversation:${conversationId}`).emit('messages-read', {
        conversationId,
        readBy: socket.userId,
        readAt: new Date(),
      });
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

  private async handleDisconnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    this.connectedUsers.delete(userId);

    // Update lastSeen and broadcast offline status
    await this.broadcastUserOnlineStatus(userId, false);

    logger.info(`🔌 User ${userId} disconnected`, {
      socketId: socket.id,
      reason: 'unknown', // Socket.io disconnect event will provide this but we need to pass it from the handler
      remainingConnected: this.connectedUsers.size
    });
  }

  /**
   * Broadcast user's online/offline status to all their conversations
   */
  private async broadcastUserOnlineStatus(
    userId: string,
    isOnline: boolean,
    updateDB: boolean = true
  ) {
    try {
      const now = new Date();

      // Get all conversations this user is part of
      const conversations = await this.chatService.getUserConversations(userId);

      // Update status in all conversations
      for (const conversation of conversations) {
        if (updateDB) {
          await this.chatService.updateParticipantStatus(
            userId,
            conversation.id,
            {
              isOnline,
              lastSeen: now, // Update lastSeen accurately
            }
          );
        }

        // Broadcast to conversation participants
        this.io.to(`conversation:${conversation.id}`).emit('user-status-changed', {
          userId,
          isOnline,
          lastSeen: now,
          conversationId: conversation.id,
        });
      }

      logger.info(`User ${userId} status broadcasted: ${isOnline ? 'online' : 'offline'}`);
    } catch (error: any) {
      logger.error('Error broadcasting user status:', error);
    }
  }

  // Call handling methods
  private handleCallInvite(socket: AuthenticatedSocket, data: any) {
    const { targetUserId, sessionId, callerName, callerImage } = data;
    logger.info(`Call invite from ${socket.userId} to ${targetUserId}`);

    // Send to target user room
    this.io.to(`user:${targetUserId}`).emit('call-invite', {
      callerId: socket.userId,
      callerName: callerName || `${socket.user?.firstName} ${socket.user?.lastName || ''}`.trim(),
      callerImage: callerImage,
      sessionId,
    });
  }

  private handleCallAccept(socket: AuthenticatedSocket, data: any) {
    const { callerId, sessionId } = data;
    logger.info(`Call accepted by ${socket.userId} for caller ${callerId}`);

    this.io.to(`user:${callerId}`).emit('call-accepted', {
      acceptorId: socket.userId,
      sessionId,
    });
  }

  private handleCallReject(socket: AuthenticatedSocket, data: any) {
    const { callerId, sessionId } = data;
    logger.info(`Call rejected by ${socket.userId} for caller ${callerId}`);

    this.io.to(`user:${callerId}`).emit('call-rejected', {
      rejectorId: socket.userId,
      sessionId,
    });
  }

  private handleCallEnd(socket: AuthenticatedSocket, data: any) {
    const { targetUserId, sessionId } = data;
    logger.info(`Call ended by ${socket.userId} for ${targetUserId}`);

    this.io.to(`user:${targetUserId}`).emit('call-ended', {
      enderId: socket.userId,
      sessionId,
    });
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

  /**
   * Broadcast message deletion to all participants in a conversation
   */
  public broadcastMessageDeletion(
    conversationId: string,
    messageId: string,
    deleteType: 'me' | 'everyone'
  ) {
    if (deleteType === 'everyone') {
      this.io.to(`conversation:${conversationId}`).emit('message-deleted', {
        messageId,
        deleteType,
      });
      logger.info(`Broadcasted message deletion for everyone: ${messageId} in ${conversationId}`);
    }
  }

  public broadcastMessageUpdate(
    conversationId: string,
    message: any
  ) {
    this.io.to(`conversation:${conversationId}`).emit('message-updated', message);
    logger.info(`Broadcasted message update: ${message.id} in ${conversationId}`);
  }
  /**
   * Broadcast message pin/unpin status change to all participants
   */
  public broadcastMessagePinStatus(
    conversationId: string,
    messageId: string,
    isPinned: boolean
  ) {
    this.io.to(`conversation:${conversationId}`).emit('message-pin-status', {
      messageId,
      conversationId,
      isPinned,
    });
    logger.info(`Broadcasted message pin status: ${messageId} isPinned=${isPinned} in ${conversationId}`);
  }

  /**
   * Broadcast message star/unstar status change to all participants
   */
  public broadcastMessageStarStatus(
    conversationId: string,
    messageId: string,
    isStarred: boolean
  ) {
    this.io.to(`conversation:${conversationId}`).emit('message-star-status', {
      messageId,
      conversationId,
      isStarred,
    });
    logger.info(`Broadcasted message star status: ${messageId} isStarred=${isStarred} in ${conversationId}`);
  }

  // Static instance helper for easy access if needed
  private static instance: WebSocketService;
  public static getInstance(): WebSocketService {
    return this.instance;
  }
}
