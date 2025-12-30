import { StreakService } from './streak.service';
import { logger } from '@/config/int-services';
import { differenceInHours, parse } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '@/database/entities/appNotification.entity';

export class StreakNotificationService {
  private streakService: StreakService;

  constructor() {
    this.streakService = new StreakService();
  }

  /**
   * Send streak reminder notifications to users at risk
   * Should be called daily (e.g., via cron job)
   */
  async sendStreakReminders(): Promise<void> {
    try {
      logger.info('Starting streak reminder job...');

      const usersAtRisk = await this.streakService.getUsersAtRiskOfLosingStreak();

      logger.info(`Found ${usersAtRisk.length} users at risk of losing their streak`);

      for (const user of usersAtRisk) {
        try {
          // Calculate how long since their last streak
          const userTimezone = user.timezone || 'UTC';
          const nowInUserTz = toZonedTime(new Date(), userTimezone);

          const lastStreakDate = typeof user.lastStreakDate === 'string'
            ? parse(user.lastStreakDate, 'yyyy-MM-dd', new Date())
            : user.lastStreakDate;

          const hoursSinceLastStreak = differenceInHours(
            nowInUserTz,
            lastStreakDate
          );

          // Only send notification if it's been more than 20 hours (8 PM their time approximately)
          // and less than 36 hours (so we don't spam if they've already lost the streak)
          if (hoursSinceLastStreak > 20 && hoursSinceLastStreak < 36) {
            await this.sendNotification(user.id, {
              title: `Don't break your ${user.currentStreak}-day streak! 🔥`,
              message: `You're doing great! Read a Bible passage today to keep your ${user.currentStreak}-day streak alive.`,
              type: 'STREAK_REMINDER',
              userId: user.id,
              currentStreak: user.currentStreak,
            });

            logger.info('Streak reminder sent', {
              userId: user.id,
              email: user.email,
              currentStreak: user.currentStreak,
              hoursSinceLastStreak,
            });
          }
        } catch (error: any) {
          logger.error(`Error sending streak reminder to user ${user.id}`, error);
          // Continue with other users even if one fails
        }
      }

      logger.info('Streak reminder job completed');
    } catch (error: any) {
      logger.error('Error in streak reminder job', error);
      throw error;
    }
  }

  /**
   * Send notification to user
   * Creates in-app notification for streak-related events
   */
  private async sendNotification(
    userId: string,
    notificationData: {
      title: string;
      message: string;
      type: string;
      userId: string;
      currentStreak: number;
    }
  ): Promise<void> {
    try {
      const notificationService = getAppNotificationService();

      // Map notification type string to enum
      let notificationType: AppNotificationType;
      switch (notificationData.type) {
        case 'STREAK_REMINDER':
          notificationType = AppNotificationType.STREAK_REMINDER;
          break;
        case 'STREAK_MILESTONE':
          notificationType = AppNotificationType.STREAK_MILESTONE;
          break;
        case 'STREAK_FREEZE_AWARDED':
          notificationType = AppNotificationType.STREAK_FREEZE_AWARDED;
          break;
        case 'STREAK_FREEZE_USED':
          notificationType = AppNotificationType.STREAK_FREEZE_USED;
          break;
        default:
          notificationType = AppNotificationType.SYSTEM;
      }

      await notificationService.createNotification({
        userId: userId,
        type: notificationType,
        title: notificationData.title,
        message: notificationData.message,
        data: {
          type: notificationData.type,
          currentStreak: notificationData.currentStreak,
        },
      });

      logger.info('Streak notification created', {
        userId,
        type: notificationData.type,
        currentStreak: notificationData.currentStreak,
      });
    } catch (error: any) {
      logger.error('Failed to create streak notification', error);
      // Don't throw - we don't want notification failures to break streak logic
    }
  }

  /**
   * Send streak milestone congratulations
   */
  async sendStreakMilestoneNotification(
    userId: string,
    milestone: number
  ): Promise<void> {
    try {
      const messages = {
        7: "Amazing! You've completed a full week! 🎉",
        30: "Incredible! 30 days in a row! You're building a powerful habit! 🚀",
        100: "WOW! 100-day streak! You're a Bible reading champion! 🏆",
        365: "LEGENDARY! A full year of daily reading! You're an inspiration! ⭐",
      };

      const message = messages[milestone as keyof typeof messages] ||
        `Congratulations on your ${milestone}-day streak! Keep it up! 🔥`;

      await this.sendNotification(userId, {
        title: `${milestone}-Day Streak Milestone! 🎊`,
        message,
        type: 'STREAK_MILESTONE',
        userId,
        currentStreak: milestone,
      });

      logger.info('Streak milestone notification sent', { userId, milestone });
    } catch (error: any) {
      logger.error('Error sending milestone notification', error);
    }
  }

  /**
   * Send streak freeze award notification
   */
  async sendStreakFreezeAwardNotification(
    userId: string,
    currentStreak: number,
    totalFreezes: number
  ): Promise<void> {
    try {
      await this.sendNotification(userId, {
        title: 'Streak Freeze Earned! ❄️',
        message: `Congratulations on your ${currentStreak}-day streak! You've earned a streak freeze. You now have ${totalFreezes} freeze${totalFreezes > 1 ? 's' : ''} available.`,
        type: 'STREAK_FREEZE_AWARDED',
        userId,
        currentStreak,
      });

      logger.info('Streak freeze award notification sent', {
        userId,
        currentStreak,
        totalFreezes,
      });
    } catch (error: any) {
      logger.error('Error sending freeze award notification', error);
    }
  }

  /**
   * Send streak freeze used notification
   */
  async sendStreakFreezeUsedNotification(
    userId: string,
    currentStreak: number,
    remainingFreezes: number
  ): Promise<void> {
    try {
      await this.sendNotification(userId, {
        title: 'Streak Freeze Used! ❄️',
        message: `Your ${currentStreak}-day streak was saved! You have ${remainingFreezes} freeze${remainingFreezes !== 1 ? 's' : ''} remaining.`,
        type: 'STREAK_FREEZE_USED',
        userId,
        currentStreak,
      });

      logger.info('Streak freeze used notification sent', {
        userId,
        currentStreak,
        remainingFreezes,
      });
    } catch (error: any) {
      logger.error('Error sending freeze used notification', error);
    }
  }
}
