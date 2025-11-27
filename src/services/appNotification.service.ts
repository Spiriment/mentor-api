import { Repository } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { AppNotification, AppNotificationType } from '../database/entities/appNotification.entity';
import { logger } from '@/config/int-services';

export class AppNotificationService {
  private notificationRepository: Repository<AppNotification>;

  constructor() {
    this.notificationRepository = AppDataSource.getRepository(AppNotification);
  }

  /**
   * Create a new in-app notification
   */
  async createNotification(data: {
    userId: string;
    type: AppNotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<AppNotification> {
    try {
      const notification = this.notificationRepository.create({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data,
        isRead: false,
      });

      const savedNotification = await this.notificationRepository.save(notification);

      logger.info('App notification created', {
        notificationId: savedNotification.id,
        userId: data.userId,
        type: data.type,
      });

      return savedNotification;
    } catch (error: any) {
      logger.error('Error creating app notification', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<AppNotification[]> {
    try {
      const queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId })
        .orderBy('notification.createdAt', 'DESC')
        .limit(limit);

      if (unreadOnly) {
        queryBuilder.andWhere('notification.isRead = :isRead', { isRead: false });
      }

      return await queryBuilder.getMany();
    } catch (error: any) {
      logger.error('Error fetching user notifications', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await this.notificationRepository.update(
        { id: notificationId, userId },
        { isRead: true, readAt: new Date() }
      );

      logger.info('Notification marked as read', { notificationId, userId });
    } catch (error: any) {
      logger.error('Error marking notification as read', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.notificationRepository.update(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );

      logger.info('All notifications marked as read', { userId });
    } catch (error: any) {
      logger.error('Error marking all notifications as read', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return await this.notificationRepository.count({
        where: { userId, isRead: false },
      });
    } catch (error: any) {
      logger.error('Error getting unread count', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    try {
      await this.notificationRepository.delete({ id: notificationId, userId });
      logger.info('Notification deleted', { notificationId, userId });
    } catch (error: any) {
      logger.error('Error deleting notification', error);
      throw error;
    }
  }
}

// Export singleton instance
let appNotificationServiceInstance: AppNotificationService | null = null;

export const getAppNotificationService = (): AppNotificationService => {
  if (!appNotificationServiceInstance) {
    appNotificationServiceInstance = new AppNotificationService();
  }
  return appNotificationServiceInstance;
};
