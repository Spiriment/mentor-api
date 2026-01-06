import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../database/entities/user.entity';
import { pushNotificationService } from '../services/pushNotification.service';
import { Logger } from '../common';
import { IsNull, Not } from 'typeorm';

export class AdminController {
  private userRepository = AppDataSource.getRepository(User);
  private logger = new Logger({
    service: 'admin-controller',
    level: process.env.LOG_LEVEL || 'info',
  });

  /**
   * Broadcast push notification to all users or based on preferences
   * POST /api/admin/broadcast-push
   */
  broadcastPushNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, body, data, preferenceCategory } = req.body;

      if (!title || !body) {
        return res.status(400).json({
          success: false,
          error: { message: 'Title and body are required' },
        });
      }

      // Find all users with a push token
      const queryOptions: any = {
        where: {
          pushToken: Not(IsNull()),
          pushNotificationsEnabled: true,
        },
        select: ['id', 'pushToken', 'notificationPreferences'],
      };

      let users = await this.userRepository.find(queryOptions);

      // Filter by preference category if provided
      if (preferenceCategory) {
        users = users.filter((user) => {
          if (!user.notificationPreferences) return true; // Default to send if no preferences set? 
          // Actually, if a category is specified, we should probably respect it.
          // Let's assume if they don't have preferences set, they get everything.
          return user.notificationPreferences.includes(preferenceCategory);
        });
      }

      if (users.length === 0) {
        return res.json({
          success: true,
          message: 'No eligible users with push tokens found',
          recipientsCount: 0,
        });
      }

      const notifications = users.map((user) => ({
        to: user.pushToken!,
        title,
        body,
        data: { ...data, category: preferenceCategory },
      }));

      // Use the sendToMany functionality in pushNotificationService
      // pushNotificationService.sendToMany expects Array<{ userId: string; pushToken: string; title: string; body: string; data?: any }>
      const manyNotifications = users.map((user) => ({
        userId: user.id,
        pushToken: user.pushToken!,
        title,
        body,
        data: { ...data, category: preferenceCategory },
      }));

      // Send in batches (handled inside sendToMany)
      await pushNotificationService.sendToMany(manyNotifications);

      this.logger.info(`Broadcast notification sent to ${users.length} users`);

      return res.json({
        success: true,
        message: `Broadcast notification sent successfully to ${users.length} users`,
        recipientsCount: users.length,
      });
    } catch (error) {
      this.logger.error('Error in broadcastPushNotification', error instanceof Error ? error : new Error(String(error)));
      next(error);
    }
  };
}

export const adminController = new AdminController();
