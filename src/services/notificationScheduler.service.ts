import { AppDataSource } from '../config/data-source';
import { ScheduledNotification } from '../database/entities/scheduledNotification.entity';
import { User } from '../database/entities/user.entity';
import { pushNotificationService } from './pushNotification.service';
import { Logger } from '../common';
import { LessThanOrEqual, In } from 'typeorm';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '../database/entities/appNotification.entity';

export class NotificationSchedulerService {
  private notificationRepository = AppDataSource.getRepository(ScheduledNotification);
  private userRepository = AppDataSource.getRepository(User);
  private logger = new Logger({
    service: 'notification-scheduler',
    level: process.env.LOG_LEVEL || 'info',
  });

  /**
   * Schedule a welcome notification for a user
   */
  async scheduleWelcomeNotification(
    userId: string,
    pushToken: string,
    firstName: string,
    delayMinutes: number = 2
  ): Promise<ScheduledNotification> {
    // First, clean up any existing duplicate pending notifications to prevent multi-sending
    await this.cancelDuplicateWelcomeNotifications(userId);

    // Check if a welcome notification already exists for this user (could be sent or just updated by cleanup)
    const existingNotification = await this.notificationRepository.findOne({
      where: {
        userId,
        type: 'welcome',
      },
    });

    if (existingNotification) {
      if (existingNotification.status === 'pending') {
        // Update the token and reschedule if it's still pending
        const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
        existingNotification.pushToken = pushToken;
        existingNotification.scheduledFor = scheduledFor;
        await this.notificationRepository.save(existingNotification);
        
        this.logger.info(
          `🔄 Updated existing pending welcome notification for user ${userId} with new token and schedule`
        );
        return existingNotification;
      } else {
        // If already sent or failed/cancelled, don't schedule a new one
        this.logger.info(
          `⏭️ Welcome notification already ${existingNotification.status} for user ${userId}, skipping.`
        );
        return existingNotification;
      }
    }

    const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

    const notification = this.notificationRepository.create({
      userId,
      pushToken,
      type: 'welcome',
      title: '🌟 Welcome to Spiriment!',
      body: `Hi ${firstName}, we're glad to have you! Explore the app to find your perfect mentorship match.`,
      data: {
        screen: 'Home',
        type: 'welcome',
      },
      scheduledFor,
      status: 'pending',
    });

    await this.notificationRepository.save(notification);

    this.logger.info(
      `📅 Scheduled welcome notification for user ${userId} at ${scheduledFor.toISOString()}`
    );

    return notification;
  }

  /**
   * Process all pending notifications that are due
   * This should be called by a cron job every minute
   */
  async processPendingNotifications(): Promise<void> {
    const now = new Date();

    // Find all pending notifications that are due
    const dueNotifications = await this.notificationRepository.find({
      where: {
        status: 'pending',
        scheduledFor: LessThanOrEqual(now),
      },
      order: {
        scheduledFor: 'ASC',
      },
      take: 100, // Process max 100 at a time
    });

    if (dueNotifications.length === 0) {
      return;
    }

    this.logger.info(
      `📬 Processing ${dueNotifications.length} pending notifications`
    );

    for (const notification of dueNotifications) {
      await this.processNotification(notification);
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(
    notification: ScheduledNotification
  ): Promise<void> {
    try {
      // Deduplication check: if this is a 'welcome' notification and one has already been sent
      // or if there's a more recent pending one, skip this one
      if (notification.type === 'welcome') {
        const alreadySent = await this.notificationRepository.findOne({
          where: {
            userId: notification.userId,
            type: 'welcome',
            status: 'sent',
          },
        });

        if (alreadySent) {
          this.logger.info(
            `⏭️ Welcome notification already sent for user ${notification.userId}, cancelling duplicate ${notification.id}`
          );
          notification.status = 'cancelled';
          await this.notificationRepository.save(notification);
          return;
        }

        // Check if there are other pending welcome notifications scheduled for later (more recent)
        // If so, cancel this one to let the most recent one handle it
        const moreRecentPending = await this.notificationRepository.findOne({
          where: {
            userId: notification.userId,
            type: 'welcome',
            status: 'pending',
          },
          order: {
            createdAt: 'DESC',
          },
        });

        if (moreRecentPending && moreRecentPending.id !== notification.id) {
          this.logger.info(
            `⏭️ Found more recent pending welcome notification for user ${notification.userId}, cancelling ${notification.id}`
          );
          notification.status = 'cancelled';
          await this.notificationRepository.save(notification);
          return;
        }
      }

      this.logger.info(
        `📤 Sending ${notification.type} notification to user ${notification.userId}`
      );

      // Send the notification
      await pushNotificationService.sendToUser({
        userId: notification.userId,
        pushToken: notification.pushToken,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      });

      // Mark as sent
      notification.status = 'sent';
      notification.sentAt = new Date();
      await this.notificationRepository.save(notification);

      // Also create an in-app notification so it appears in the Notifications list
      try {
        const appNotificationService = getAppNotificationService();
        await appNotificationService.createNotification({
          userId: notification.userId,
          type: notification.type as any, // Map ScheduledNotificationType to AppNotificationType
          title: notification.title,
          message: notification.body,
          data: notification.data,
        });
      } catch (appNotifError) {
        this.logger.error(
          `⚠️ Failed to create matching in-app notification for ${notification.id}`,
          appNotifError instanceof Error ? appNotifError : new Error(String(appNotifError))
        );
        // Don't fail the whole process if in-app notification creation fails
      }

      this.logger.info(
        `✅ Successfully sent ${notification.type} notification to user ${notification.userId}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send ${notification.type} notification to user ${notification.userId}`,
        error instanceof Error ? error : new Error(String(error))
      );

      // Update retry count and status
      notification.retryCount += 1;
      notification.errorMessage = error instanceof Error ? error.message : String(error);

      // If retry count exceeds 3, mark as failed
      if (notification.retryCount >= 3) {
        notification.status = 'failed';
        this.logger.error(
          `❌ Notification ${notification.id} failed after 3 retries`
        );
      } else {
        // Reschedule for 5 minutes later
        notification.scheduledFor = new Date(Date.now() + 5 * 60 * 1000);
        this.logger.info(
          `🔄 Rescheduling notification ${notification.id} for retry ${notification.retryCount}`
        );
      }

      await this.notificationRepository.save(notification);
    }
  }

  /**
   * Cancel all pending notifications for a user
   */
  async cancelUserNotifications(userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        userId,
        status: 'pending',
      },
      {
        status: 'cancelled',
      }
    );

    this.logger.info(`🚫 Cancelled all pending notifications for user ${userId}`);
  }

  /**
   * Cancel duplicate pending welcome notifications for a user
   * Keeps only the most recently scheduled one
   */
  async cancelDuplicateWelcomeNotifications(userId: string): Promise<void> {
    const pendingWelcomes = await this.notificationRepository.find({
      where: {
        userId,
        type: 'welcome',
        status: 'pending',
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (pendingWelcomes.length <= 1) {
      return;
    }

    // Keep the first one (most recent), cancel the rest
    const toCancel = pendingWelcomes.slice(1);
    const cancelIds = toCancel.map((n) => n.id);

    await this.notificationRepository.update(
      { id: In(cancelIds) },
      { status: 'cancelled' }
    );

    this.logger.info(
      `🚫 Cancelled ${cancelIds.length} duplicate pending welcome notifications for user ${userId}`
    );
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  async cleanupOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.notificationRepository.delete({
      createdAt: LessThanOrEqual(thirtyDaysAgo),
      status: In(['sent', 'failed', 'cancelled']),
    });

    this.logger.info(
      `🧹 Cleaned up ${result.affected || 0} old notifications`
    );
  }
}

export const notificationSchedulerService = new NotificationSchedulerService();
