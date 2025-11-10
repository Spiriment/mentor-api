import { AppDataSource } from '@/config/data-source';
import { AppNotification, AppNotificationType } from '@/database/entities/appNotification.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export class NotificationService {
  private notificationRepository = AppDataSource.getRepository(AppNotification);

  /**
   * Get user's notifications
   */
  async getUserNotifications(
    userId: string,
    options: {
      isRead?: boolean;
      type?: AppNotificationType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ notifications: AppNotification[]; total: number; unreadCount: number }> {
    try {
      const queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId })
        .orderBy('notification.createdAt', 'DESC');

      if (options.isRead !== undefined) {
        queryBuilder.andWhere('notification.isRead = :isRead', {
          isRead: options.isRead,
        });
      }

      if (options.type) {
        queryBuilder.andWhere('notification.type = :type', {
          type: options.type,
        });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get unread count
      const unreadCount = await this.notificationRepository.count({
        where: { userId, isRead: false },
      });

      // Apply pagination
      if (options.limit) {
        queryBuilder.take(options.limit);
      }
      if (options.offset) {
        queryBuilder.skip(options.offset);
      }

      const notifications = await queryBuilder.getMany();

      return { notifications, total, unreadCount };
    } catch (error: any) {
      logger.error('Error getting user notifications', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<AppNotification> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        throw new AppError('Notification not found', StatusCodes.NOT_FOUND);
      }

      notification.isRead = true;
      notification.readAt = new Date();

      const updatedNotification = await this.notificationRepository.save(notification);

      logger.info('Notification marked as read', {
        notificationId,
        userId,
      });

      return updatedNotification;
    } catch (error: any) {
      logger.error('Error marking notification as read', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    try {
      const result = await this.notificationRepository.update(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      logger.info('All notifications marked as read', {
        userId,
        count: result.affected || 0,
      });

      return { count: result.affected || 0 };
    } catch (error: any) {
      logger.error('Error marking all notifications as read', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        throw new AppError('Notification not found', StatusCodes.NOT_FOUND);
      }

      await this.notificationRepository.remove(notification);

      logger.info('Notification deleted', {
        notificationId,
        userId,
      });
    } catch (error: any) {
      logger.error('Error deleting notification', error);
      throw error;
    }
  }
}

