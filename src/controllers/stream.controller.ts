import { Request, Response, NextFunction } from 'express';
import { StreamService } from '../core/stream.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export class StreamController {
  private streamService: StreamService;
  private logger: Logger;

  constructor() {
    this.streamService = new StreamService();
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
}
