import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { pushNotificationService } from './pushNotification.service';
import { LessThan, IsNull } from 'typeorm';
import { subDays } from 'date-fns';
import { USER_ROLE } from '@/common/constants';

export class ReengagementService {
  private userRepository = AppDataSource.getRepository(User);

  constructor(private emailService: EmailService) {}

  /**
   * Send re-engagement emails and push notifications to inactive users
   */
  async sendReengagementNotifications(): Promise<void> {
    try {
      const now = new Date();

      // Find users inactive for 3, 7, and 30 days
      await Promise.all([
        this.sendDay3Reengagement(now),
        this.sendDay7Reengagement(now),
        this.sendDay30Reengagement(now),
      ]);

      logger.info('Re-engagement notifications job completed');
    } catch (error) {
      logger.error(
        'Error in sendReengagementNotifications:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send re-engagement for users inactive for 3 days
   */
  private async sendDay3Reengagement(now: Date): Promise<void> {
    try {
      const threeDaysAgo = subDays(now, 3);
      const twoDaysAgo = subDays(now, 2);

      // Find users who were last active between 2-3 days ago
      // and haven't received day 3 email yet
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.lastActiveAt <= :threeDaysAgo', { threeDaysAgo })
        .andWhere('user.lastActiveAt > :twoDaysAgo', { twoDaysAgo })
        .andWhere(
          "(user.reengagementEmailsSent IS NULL OR JSON_EXTRACT(user.reengagementEmailsSent, '$.day3') IS NULL)"
        )
        .getMany();

      logger.info(`Found ${users.length} users for day 3 re-engagement`);

      for (const user of users) {
        await this.sendReengagementEmail(user, 3);
        await this.sendReengagementPushNotification(user, 3);
        await this.markReengagementSent(user, 3);
      }
    } catch (error) {
      logger.error(
        'Error in sendDay3Reengagement:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send re-engagement for users inactive for 7 days
   */
  private async sendDay7Reengagement(now: Date): Promise<void> {
    try {
      const sevenDaysAgo = subDays(now, 7);
      const sixDaysAgo = subDays(now, 6);

      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.lastActiveAt <= :sevenDaysAgo', { sevenDaysAgo })
        .andWhere('user.lastActiveAt > :sixDaysAgo', { sixDaysAgo })
        .andWhere(
          "(user.reengagementEmailsSent IS NULL OR JSON_EXTRACT(user.reengagementEmailsSent, '$.day7') IS NULL)"
        )
        .getMany();

      logger.info(`Found ${users.length} users for day 7 re-engagement`);

      for (const user of users) {
        await this.sendReengagementEmail(user, 7);
        await this.sendReengagementPushNotification(user, 7);
        await this.markReengagementSent(user, 7);
      }
    } catch (error) {
      logger.error(
        'Error in sendDay7Reengagement:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send re-engagement for users inactive for 30 days
   */
  private async sendDay30Reengagement(now: Date): Promise<void> {
    try {
      const thirtyDaysAgo = subDays(now, 30);
      const twentyNineDaysAgo = subDays(now, 29);

      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.lastActiveAt <= :thirtyDaysAgo', { thirtyDaysAgo })
        .andWhere('user.lastActiveAt > :twentyNineDaysAgo', { twentyNineDaysAgo })
        .andWhere(
          "(user.reengagementEmailsSent IS NULL OR JSON_EXTRACT(user.reengagementEmailsSent, '$.day30') IS NULL)"
        )
        .getMany();

      logger.info(`Found ${users.length} users for day 30 re-engagement`);

      for (const user of users) {
        await this.sendReengagementEmail(user, 30);
        await this.sendReengagementPushNotification(user, 30);
        await this.markReengagementSent(user, 30);
      }
    } catch (error) {
      logger.error(
        'Error in sendDay30Reengagement:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send re-engagement email
   */
  private async sendReengagementEmail(user: User, days: 3 | 7 | 30): Promise<void> {
    try {
      const userName = user.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user.email;

      const roleSpecific =
        user.role === USER_ROLE.MENTOR
          ? 'mentees and fellow mentors'
          : 'mentor and fellow mentees';

      const appLink = process.env.FRONTEND_URL || 'https://spiriment.com';

      const templateMap = {
        3: 'reengagement-day3',
        7: 'reengagement-day7',
        30: 'reengagement-day30',
      };

      const subjectMap = {
        3: 'We Miss You at Spiriment! 👋',
        7: 'Your Spiritual Journey Awaits 💚',
        30: "We'd Love to See You Back at Spiriment 🙏",
      };

      await this.emailService.sendEmailWithTemplate({
        to: user.email,
        subject: subjectMap[days],
        partialName: templateMap[days],
        templateData: {
          userName,
          roleSpecific,
          appLink,
        },
      });

      logger.info(`Day ${days} re-engagement email sent to ${user.email}`);
    } catch (error) {
      logger.error(
        `Error sending day ${days} re-engagement email to ${user.email}:`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send re-engagement push notification
   */
  private async sendReengagementPushNotification(
    user: User,
    days: 3 | 7 | 30
  ): Promise<void> {
    try {
      if (!user.pushToken) {
        return;
      }

      const titleMap = {
        3: '👋 We Miss You!',
        7: "💚 Don't Let Your Progress Fade",
        30: '🙏 Your Faith Community Misses You',
      };

      const bodyMap = {
        3: "It's been 3 days! Come back and continue your spiritual growth journey.",
        7: "It's been a week! Your spiritual progress is waiting for you.",
        30: "It's been a month! We'd love to see you back at Spiriment.",
      };

      await pushNotificationService.sendToUser({
        userId: user.id,
        pushToken: user.pushToken,
        title: titleMap[days],
        body: bodyMap[days],
        data: {
          type: 'reengagement',
          days: days.toString(),
        },
        channelId: 'default',
      });

      logger.info(`Day ${days} re-engagement push notification sent to user ${user.id}`);
    } catch (error) {
      logger.error(
        `Error sending day ${days} re-engagement push notification to user ${user.id}:`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Mark re-engagement as sent
   */
  private async markReengagementSent(user: User, days: 3 | 7 | 30): Promise<void> {
    try {
      const reengagementEmailsSent = user.reengagementEmailsSent || {};
      const dayKey = `day${days}` as 'day3' | 'day7' | 'day30';
      reengagementEmailsSent[dayKey] = new Date();

      await this.userRepository.update(user.id, {
        reengagementEmailsSent,
        lastReengagementEmailSentAt: new Date(),
      });

      logger.debug(`Marked day ${days} re-engagement sent for user ${user.id}`);
    } catch (error) {
      logger.error(
        `Error marking day ${days} re-engagement sent for user ${user.id}:`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
