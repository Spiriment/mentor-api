import { Request, Response, NextFunction } from 'express';
import { getAppNotificationService } from '../services/appNotification.service';
import { AppError } from '../common/errors';
import { StatusCodes } from 'http-status-codes';
import { sendSuccessResponse } from '@/common/helpers';
import { logger } from '@/config/int-services';

export class AppNotificationController {
  private notificationService = getAppNotificationService();

  /**
   * Get notifications for the authenticated user
   * GET /api/notifications
   */
  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const unreadOnly = req.query.unreadOnly === 'true';

      const notifications = await this.notificationService.getUserNotifications(
        user.id,
        limit,
        unreadOnly
      );

      logger.info('Notifications fetched successfully', {
        userId: user.id,
        count: notifications.length,
        unreadOnly,
      });

      return sendSuccessResponse(res, {
        notifications,
        total: notifications.length,
      });
    } catch (error: any) {
      logger.error('Error fetching notifications', error);
      next(error);
    }
  };

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const count = await this.notificationService.getUnreadCount(user.id);

      logger.info('Unread count fetched successfully', {
        userId: user.id,
        count,
      });

      return sendSuccessResponse(res, { count });
    } catch (error: any) {
      logger.error('Error fetching unread count', error);
      next(error);
    }
  };

  /**
   * Mark notification as read
   * PATCH /api/notifications/:notificationId/read
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { notificationId } = req.params;

      await this.notificationService.markAsRead(notificationId, user.id);

      logger.info('Notification marked as read', {
        userId: user.id,
        notificationId,
      });

      return sendSuccessResponse(res, {
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      logger.error('Error marking notification as read', error);
      next(error);
    }
  };

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      await this.notificationService.markAllAsRead(user.id);

      logger.info('All notifications marked as read', {
        userId: user.id,
      });

      return sendSuccessResponse(res, {
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      logger.error('Error marking all notifications as read', error);
      next(error);
    }
  };

  /**
   * Delete notification
   * DELETE /api/notifications/:notificationId
   */
  deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { notificationId } = req.params;

      await this.notificationService.deleteNotification(notificationId, user.id);

      logger.info('Notification deleted', {
        userId: user.id,
        notificationId,
      });

      return sendSuccessResponse(res, {
        message: 'Notification deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting notification', error);
      next(error);
    }
  };
}
