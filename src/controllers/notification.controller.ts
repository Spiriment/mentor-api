import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { AppNotificationType } from '@/database/entities/appNotification.entity';

export class NotificationController {
  private notificationService: NotificationService;
  private logger: Logger;

  constructor() {
    this.notificationService = new NotificationService();
    this.logger = new Logger({
      service: 'notification-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Get user's notifications
   * GET /api/notifications
   */
  getUserNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const options = {
        isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
        type: req.query.type as AppNotificationType,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = await this.notificationService.getUserNotifications(
        user.id,
        options
      );

      return sendSuccessResponse(res, {
        notifications: result.notifications,
        total: result.total,
        unreadCount: result.unreadCount,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: result.total,
          pages: Math.ceil(result.total / options.limit),
        },
        message: 'Notifications retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting user notifications', error);
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

      const notification = await this.notificationService.markAsRead(
        notificationId,
        user.id
      );

      return sendSuccessResponse(res, {
        notification,
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      this.logger.error('Error marking notification as read', error);
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

      const result = await this.notificationService.markAllAsRead(user.id);

      return sendSuccessResponse(res, {
        count: result.count,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      this.logger.error('Error marking all notifications as read', error);
      next(error);
    }
  };

  /**
   * Delete notification
   * DELETE /api/notifications/:notificationId
   */
  deleteNotification = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { notificationId } = req.params;

      await this.notificationService.deleteNotification(notificationId, user.id);

      return sendSuccessResponse(res, {
        message: 'Notification deleted successfully',
      });
    } catch (error: any) {
      this.logger.error('Error deleting notification', error);
      next(error);
    }
  };
}

