import { Request, Response, NextFunction } from 'express';
import { AgoraService } from '../core/agora.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { SessionService } from '../services/session.service';

export class AgoraController {
  private agoraService: AgoraService;
  private sessionService: SessionService;
  private logger: Logger;

  constructor() {
    this.agoraService = new AgoraService();
    this.sessionService = new SessionService();
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

      // Verify user is part of this session
      const session = await this.sessionService.getSessionById(
        sessionId,
        user.id
      );

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
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
