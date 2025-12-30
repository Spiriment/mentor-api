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

  /**
   * Get monthly streak data for a specific month
   * GET /api/auth/streak/monthly/:year/:month
   */
  getMonthlyStreakData = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        this.logger.error('getMonthlyStreakData: User not authenticated', undefined, {
          hasUser: !!req.user,
          userId: (req.user as any)?.id,
        });
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED',
          },
        });
      }

      if (!user.id) {
        this.logger.error('getMonthlyStreakData: User ID is missing', undefined, {
          user: JSON.stringify(user),
        });
        return res.status(401).json({
          success: false,
          error: {
            message: 'User ID is missing',
            code: 'UNAUTHORIZED',
          },
        });
      }

      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid year or month parameter',
            code: 'INVALID_PARAMS',
          },
        });
      }

      this.logger.info('Getting monthly streak data', {
        userId: user.id,
        year,
        month,
      });

      const streakDays = await this.streakService.getMonthlyStreakData(
        user.id,
        year,
        month
      );

      return sendSuccessResponse(res, {
        year,
        month,
        streakDays,
      });
    } catch (error: any) {
      this.logger.error(
        'Error getting monthly streak data',
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: (req.user as any)?.id,
          year: req.params.year,
          month: req.params.month,
        }
      );
      next(error);
    }
  };
}
