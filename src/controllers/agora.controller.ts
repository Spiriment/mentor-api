import { Request, Response, NextFunction } from 'express';
import { AgoraService } from '../core/agora.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { SessionService } from '../services/session.service';
import { ChatService } from '../services/chat.service';
import { AppDataSource } from '@/config/data-source';

export class AgoraController {
  private agoraService: AgoraService;
  private sessionService: SessionService;
  private chatService: ChatService;
  private logger: Logger;

  constructor() {
    this.agoraService = new AgoraService();
    this.sessionService = new SessionService();
    this.chatService = new ChatService(AppDataSource);
    this.logger = new Logger({
      service: 'agora-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Generate Agora token for a session
   * POST /api/agora/token
   */
  generateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.body;

      if (!sessionId) {
        throw new AppError('Session ID is required', StatusCodes.BAD_REQUEST);
      }

      // 1. First, try to find a mentorship session
      let session = null;
      try {
        session = await this.sessionService.getSessionById(
          sessionId,
          user.id
        );
      } catch (error) {
        // If it's not a session, we'll try to find a conversation next
        this.logger.debug('ID is not a session ID, checking conversation', { sessionId });
      }

      // 2. If no session, check if it's a conversation
      if (!session) {
        const isParticipant = await this.chatService.isUserParticipant(
          user.id,
          sessionId
        );

        if (!isParticipant) {
          throw new AppError(
            'You do not have permission to join this call (not a session or conversation participant)',
            StatusCodes.FORBIDDEN
          );
        }
      }

      // Use session ID as channel name
      const channelName = sessionId;
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
}
