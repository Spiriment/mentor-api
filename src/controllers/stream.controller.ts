import { Request, Response, NextFunction } from 'express';
import { StreamService } from '../core/stream.service';
import { ChatService } from '../services/chat.service';
import { WebSocketService } from '../services/websocket.service';
import { AppDataSource } from '@/config/data-source';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export class StreamController {
  private streamService: StreamService;
  private chatService: ChatService;
  private logger: Logger;

  constructor() {
    this.streamService = new StreamService();
    this.chatService = new ChatService(AppDataSource);
    this.logger = new Logger({
      service: 'stream-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Generate Stream user token
   * GET /api/stream/token
   */
  generateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      // Generate token (valid for 1 hour)
      const token = this.streamService.generateUserToken(user.id, 3600);
      const apiKey = this.streamService.getApiKey();

      this.logger.info('Stream token requested', { userId: user.id });

      return sendSuccessResponse(res, {
        token,
        apiKey,
        userId: user.id,
        expirationTime: 3600,
        message: 'Stream token generated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error generating Stream token', error);
      next(error);
    }
  };

  /**
   * Log call outcome to conversation
   * POST /api/stream/log-call
   */
  logCallOutcome = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { conversationId, callStatus, duration } = req.body;

      if (!conversationId) {
        throw new AppError('conversationId is required', StatusCodes.BAD_REQUEST);
      }

      if (!callStatus || !['completed', 'missed', 'rejected', 'failed', 'cancelled'].includes(callStatus)) {
        throw new AppError('Invalid callStatus', StatusCodes.BAD_REQUEST);
      }

      // Verify user is a participant in the conversation
      const isParticipant = await this.chatService.isUserParticipant(
        user.id,
        conversationId
      );

      if (!isParticipant) {
        throw new AppError(
          'You are not a participant in this conversation',
          StatusCodes.FORBIDDEN
        );
      }

      // Create call log message
      const message = await this.chatService.createCallLog({
        conversationId,
        senderId: user.id,
        callStatus,
        duration: duration || 0,
      });

      // Broadcast call log via WebSocket
      const wsService = WebSocketService.getInstance();
      if (wsService) {
        wsService.broadcastNewMessage(conversationId, message);
      }

      this.logger.info('Call outcome logged via Stream controller', {
        conversationId,
        callStatus,
        duration,
        userId: user.id,
      });

      return sendSuccessResponse(res, {
        message: 'Call outcome logged successfully',
        callLog: message,
      });
    } catch (error: any) {
      this.logger.error('Error logging call outcome', error);
      next(error);
    }
  };
}
