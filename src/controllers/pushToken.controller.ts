import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../database/entities/user.entity';
import { Logger } from '../common';

export class PushTokenController {
  private userRepository = AppDataSource.getRepository(User);
  private logger = new Logger({
    service: 'push-token-controller',
    level: process.env.LOG_LEVEL || 'info',
  });

  /**
   * Save or update user's push token
   * POST /api/users/push-token
   */
  savePushToken = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { pushToken } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Unauthorized' },
        });
      }

      if (!pushToken) {
        return res.status(400).json({
          success: false,
          error: { message: 'Push token is required' },
        });
      }

      // Update user's push token
      await this.userRepository.update(userId, { pushToken });

      this.logger.info(`Push token updated for user ${userId}`);

      return res.status(200).json({
        success: true,
        data: { message: 'Push token saved successfully' },
      });
    } catch (error) {
      this.logger.error('Error saving push token', error instanceof Error ? error : new Error(String(error)));
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to save push token' },
      });
    }
  };

  /**
   * Remove user's push token (on logout)
   * DELETE /api/users/push-token
   */
  removePushToken = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Unauthorized' },
        });
      }

      // Remove user's push token
      await this.userRepository.update(userId, { pushToken: null });

      this.logger.info(`Push token removed for user ${userId}`);

      return res.status(200).json({
        success: true,
        data: { message: 'Push token removed successfully' },
      });
    } catch (error) {
      this.logger.error('Error removing push token', error instanceof Error ? error : new Error(String(error)));
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to remove push token' },
      });
    }
  };
}

export const pushTokenController = new PushTokenController();
