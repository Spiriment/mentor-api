import { Request, Response, NextFunction } from 'express';
import { AgoraService } from '../core/agora.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { SessionService } from '../services/session.service';
import { ChatService } from '../services/chat.service';
import { GroupSessionService } from '../services/groupSession.service';
import { AppDataSource } from '@/config/data-source';

export class AgoraController {
  private agoraService: AgoraService;
  private sessionService: SessionService;
  private chatService: ChatService;
  private groupSessionService: GroupSessionService;
  private logger: Logger;

  constructor() {
    this.agoraService = new AgoraService();
    this.sessionService = new SessionService();
    this.chatService = new ChatService(AppDataSource);
    this.groupSessionService = new GroupSessionService();
    this.logger = new Logger({
      service: 'agora-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Generate Agora token for a session or direct call
   * POST /api/agora/token
   */
  generateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId, targetUserId } = req.body;

      // For direct calls without a sessionId, we need targetUserId
      if (!sessionId && !targetUserId) {
        throw new AppError('Either sessionId or targetUserId is required', StatusCodes.BAD_REQUEST);
      }

      // Determine channel name based on call type
      let channelName: string;

      if (sessionId) {
        // Scheduled session or group session call
        // 1. First, try to find a mentorship session
        let session = null;
        try {
          session = await this.sessionService.getSessionById(
            sessionId,
            user.id
          );
        } catch (error) {
          // If it's not a session, we'll try to find a conversation next
          this.logger.debug('ID is not a session ID, checking group session', { sessionId });
        }

        // 2. If no session, check if it's a group session
        if (!session) {
          try {
            const groupSession = await this.groupSessionService.getGroupSession(
              sessionId,
              user.id
            );
            if (groupSession) {
              session = groupSession;
            }
          } catch (error) {
            this.logger.debug('ID is not a group session ID', { sessionId });
          }
        }

        // 3. If still no session, check if it's a conversation
        if (!session) {
          const isParticipant = await this.chatService.isUserParticipant(
            user.id,
            sessionId
          );

          if (!isParticipant) {
            throw new AppError(
              'You do not have permission to join this call (not a session, group session or conversation participant)',
              StatusCodes.FORBIDDEN
            );
          }
        }

        // Use session ID as channel name
        channelName = sessionId;
      } else if (targetUserId) {
        // Direct call from chat - generate channel name from user IDs
        // Sort IDs to ensure consistent channel names regardless of who initiates
        const sortedIds = [user.id, targetUserId].sort();
        channelName = `chat_${sortedIds[0]}_${sortedIds[1]}`.replace(/[^a-zA-Z0-9]/g, '_');

        this.logger.info('Generating token for direct call', {
          caller: user.id,
          target: targetUserId,
          channelName,
        });
      } else {
        throw new AppError('Invalid call parameters', StatusCodes.BAD_REQUEST);
      }
      const userId = user.id;
      const role = 'publisher'; // Both mentor and mentee can publish (video/audio)

      // Generate token (valid for 1 hour)
      const token = this.agoraService.generateRtcToken(
        channelName,
        userId,
        role,
        3600
      );

      const appId = this.agoraService.getAppId();

      return sendSuccessResponse(res, {
        token,
        appId,
        channelName,
        userId: this.agoraService['hashUserId'](userId),
        expirationTime: 3600,
        message: 'Agora token generated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error generating Agora token', error);
      next(error);
    }
  };

  /**
   * Log call outcome to conversation
   * POST /api/agora/log-call
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

      this.logger.info('Call outcome logged', {
        conversationId,
        callStatus,
        duration,
        messageId: message.id,
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
