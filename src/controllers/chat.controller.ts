import { Request, Response } from 'express';
import { logger } from '@/config/int-services';
import { ChatService } from '@/services/chat.service';
import { AppDataSource } from '@/config/data-source';
import { CONVERSATION_TYPE, MESSAGE_TYPE } from '@/database/entities';

const chatService = new ChatService(AppDataSource);

export class ChatController {
  // Get user's conversations
  static async getConversations(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { limit = 50, offset = 0 } = req.query;

      const conversations = await chatService.getUserConversations(
        userId,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        success: true,
        data: {
          conversations,
          total: conversations.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
        message: 'Conversations retrieved successfully',
      });
    } catch (error: any) {
      logger.error('Error getting conversations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve conversations',
          details: error.message,
        },
      });
    }
  }

  // Get specific conversation with messages
  static async getConversation(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { conversationId } = req.params;
      const { limit = 50, offset = 0, beforeMessageId } = req.query;

      // Verify user is participant
      const isParticipant = await chatService.isUserParticipant(
        userId,
        conversationId
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Not authorized to access this conversation',
          },
        });
      }

      // Get conversation details
      const conversation = await chatService.getConversationById(
        conversationId
      );
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Conversation not found',
          },
        });
      }

      // Get messages
      const messages = await chatService.getConversationMessages(
        conversationId,
        parseInt(limit as string),
        parseInt(offset as string),
        beforeMessageId as string
      );

      res.json({
        success: true,
        data: {
          conversation,
          messages,
          total: messages.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
        message: 'Conversation retrieved successfully',
      });
    } catch (error: any) {
      logger.error('Error getting conversation:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve conversation',
          details: error.message,
        },
      });
    }
  }

  // Create new conversation
  static async createConversation(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
          },
        });
      }
      const { participantIds, type, title, description } = req.body;

      if (
        !participantIds ||
        !Array.isArray(participantIds) ||
        participantIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Participant IDs are required',
          },
        });
      }

      // Ensure current user is included in participants
      const allParticipants = [...new Set([userId, ...participantIds])];

      const conversationData = {
        participantIds: allParticipants,
        type: type || CONVERSATION_TYPE.MENTOR_MENTEE,
        title: title || null,
        description: description || null,
        createdBy: userId,
      };

      const conversation = await chatService.createConversation(
        conversationData
      );

      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Conversation created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating conversation:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create conversation',
          details: error.message,
        },
      });
    }
  }

  // Send message (for REST API - WebSocket is preferred)
  static async sendMessage(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { conversationId, content, type, metadata } = req.body;

      if (!conversationId || !content) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Conversation ID and content are required',
          },
        });
      }

      // Verify user is participant
      const isParticipant = await chatService.isUserParticipant(
        userId,
        conversationId
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Not authorized to send messages to this conversation',
          },
        });
      }

      const messageData = {
        conversationId,
        senderId: userId,
        content,
        type: type || MESSAGE_TYPE.TEXT,
        metadata: metadata || null,
      };

      const message = await chatService.createMessage(messageData);

      // Update conversation last message
      await chatService.updateConversationLastMessage(conversationId, message);

      res.status(201).json({
        success: true,
        data: message,
        message: 'Message sent successfully',
      });
    } catch (error: any) {
      logger.error('Error sending message:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to send message',
          details: error.message,
        },
      });
    }
  }

  // Mark conversation as read
  static async markConversationRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { conversationId } = req.params;

      // Verify user is participant
      const isParticipant = await chatService.isUserParticipant(
        userId,
        conversationId
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Not authorized to access this conversation',
          },
        });
      }

      await chatService.markConversationAsRead(conversationId, userId);

      res.json({
        success: true,
        message: 'Conversation marked as read',
      });
    } catch (error: any) {
      logger.error('Error marking conversation as read:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to mark conversation as read',
          details: error.message,
        },
      });
    }
  }

  // Mark specific message as read
  static async markMessageRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { messageId } = req.params;

      await chatService.markMessageAsRead(messageId, userId);

      res.json({
        success: true,
        message: 'Message marked as read',
      });
    } catch (error: any) {
      logger.error('Error marking message as read:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to mark message as read',
          details: error.message,
        },
      });
    }
  }

  // Add reaction to message
  static async addReaction(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { messageId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Emoji is required',
          },
        });
      }

      await chatService.addReactionToMessage(messageId, userId, emoji);

      res.json({
        success: true,
        message: 'Reaction added successfully',
      });
    } catch (error: any) {
      logger.error('Error adding reaction:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to add reaction',
          details: error.message,
        },
      });
    }
  }

  // Remove reaction from message
  static async removeReaction(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { messageId } = req.params;

      await chatService.removeReactionFromMessage(messageId, userId);

      res.json({
        success: true,
        message: 'Reaction removed successfully',
      });
    } catch (error: any) {
      logger.error('Error removing reaction:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to remove reaction',
          details: error.message,
        },
      });
    }
  }

  // Get conversation participants
  static async getConversationParticipants(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { conversationId } = req.params;

      // Verify user is participant
      const isParticipant = await chatService.isUserParticipant(
        userId,
        conversationId
      );
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Not authorized to access this conversation',
          },
        });
      }

      const conversation = await chatService.getConversationById(
        conversationId
      );
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Conversation not found',
          },
        });
      }

      res.json({
        success: true,
        data: {
          participants: conversation.participants,
        },
        message: 'Participants retrieved successfully',
      });
    } catch (error: any) {
      logger.error('Error getting conversation participants:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve participants',
          details: error.message,
        },
      });
    }
  }
}
