import { Request, Response, NextFunction } from 'express';
import { StreakService } from '../services/streak.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';

export class StreakController {
  private streakService: StreakService;
  private logger: Logger;

  constructor() {
    this.streakService = new StreakService();
    this.logger = new Logger({
      service: 'streak-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Increment user's streak
   * POST /api/auth/streak/increment
   */
  incrementStreak = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED',
          },
        });
      }

      const streakData = await this.streakService.incrementStreak(user.id);

      this.logger.info('Streak incremented successfully', {
        userId: user.id,
        currentStreak: streakData.currentStreak,
      });

      return sendSuccessResponse(res, {
        ...streakData,
        message: 'Streak incremented successfully',
      });
    } catch (error: any) {
      this.logger.error('Error incrementing streak', error);
      next(error);
    }
  };

  /**
   * Get user's streak data
   * GET /api/auth/streak
   */
  getStreakData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED',
          },
        });
      }

      const streakData = await this.streakService.getStreakData(user.id);

      return sendSuccessResponse(res, streakData);
    } catch (error: any) {
      this.logger.error('Error getting streak data', error);
      next(error);
    }
  };

  /**
   * Reset weekly streak data
   * POST /api/auth/streak/reset-weekly
   */
  resetWeeklyStreakData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED',
          },
        });
      }

      await this.streakService.resetWeeklyStreakData(user.id);

      this.logger.info('Weekly streak data reset successfully', {
        userId: user.id,
      });

      return sendSuccessResponse(res, {
        message: 'Weekly streak data reset successfully',
      });
    } catch (error: any) {
      this.logger.error('Error resetting weekly streak data', error);
      next(error);
    }
  };
}
