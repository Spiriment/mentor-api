import { Request, Response } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../database/entities/user.entity';
import { Logger } from '../common';
import { isValidVersion, normalizePlatform } from '../common/appRelease';
import { notificationSchedulerService } from '../services/notificationScheduler.service';

export class PushTokenController {
  private userRepository = AppDataSource.getRepository(User);
  private logger = new Logger({
    service: 'push-token-controller',
    level: process.env.LOG_LEVEL || 'info',
  });

  /**
   * Record the platform + native app version the user is running.
   * POST /api/users/app-info — called on every launch, independent of notification
   * permission (the push-token save only happens when notifications are allowed, so it
   * alone would make 1.0.5+ users without notifications look like old builds).
   */
  saveAppInfo = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
    }
    const pushPlatform = normalizePlatform(req.body?.platform);
    const appVersion = isValidVersion(req.body?.appVersion) ? req.body.appVersion.trim() : null;
    if (!pushPlatform || !appVersion) {
      return res.status(400).json({
        success: false,
        error: { message: 'platform (ios|android) and appVersion are required' },
      });
    }
    try {
      await this.userRepository.update(userId, { pushPlatform, appVersion });
      return res.json({ success: true, data: { pushPlatform, appVersion } });
    } catch (error) {
      this.logger.error('Failed to save app info', error as Error);
      return res.status(500).json({ success: false, error: { message: 'Failed to save app info' } });
    }
  };

  /**
   * Save or update user's push token
   * POST /api/users/push-token
   */
  savePushToken = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { pushToken } = req.body;
      // Sent by app builds from 1.0.5; older builds send only the token (left as null)
      const pushPlatform = normalizePlatform(req.body?.platform);
      const appVersion = isValidVersion(req.body?.appVersion) ? req.body.appVersion.trim() : null;

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
      await this.userRepository.update(userId, {
        pushToken,
        ...(pushPlatform && { pushPlatform }),
        ...(appVersion && { appVersion }),
      });


      this.logger.info(`Push token updated for user ${userId}`);

      // Get user's first name for the welcome notification
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'firstName'],
      });

      this.logger.info(`📋 User found: ${user?.id}, firstName: ${user?.firstName}`);

      // Schedule a welcome notification in the database (survives server restarts)
      try {
        this.logger.info(`🔔 Attempting to schedule welcome notification for user ${userId}`);
        
        const scheduledNotification = await notificationSchedulerService.scheduleWelcomeNotification(
          userId,
          pushToken,
          user?.firstName || 'User',
          2 // 2 minutes delay
        );

        this.logger.info(`✅ Welcome notification scheduled successfully: ${scheduledNotification.id}`);
      } catch (scheduleError) {
        this.logger.error('❌ FAILED to schedule welcome notification', scheduleError instanceof Error ? scheduleError : new Error(String(scheduleError)));
        // Don't fail the whole request if notification scheduling fails
      }

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
