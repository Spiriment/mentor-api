import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { APP_DEEP_LINK_ONBOARDING } from '@/common/constants/appDeepLinks';
import { pushNotificationService } from './pushNotification.service';
import { subDays } from 'date-fns';

type ReminderDay = 1 | 3 | 7;

/**
 * Email users who signed up but never finished onboarding.
 * Sequence: ~1 day, ~3 days, ~7 days after account creation, then stop.
 * Optional: one push ~1 day after the day-7 email if they still have a push token.
 */
export class OnboardingReminderService {
  private userRepository = AppDataSource.getRepository(User);

  constructor(private emailService: EmailService) {}

  async sendOnboardingReminders(): Promise<void> {
    try {
      const now = new Date();
      await Promise.all([
        this.sendReminderForDay(now, 1),
        this.sendReminderForDay(now, 3),
        this.sendReminderForDay(now, 7),
      ]);
      await this.sendPostSequencePush(now);
      logger.info('Onboarding reminder job completed');
    } catch (error) {
      logger.error(
        'Error in sendOnboardingReminders:',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async sendReminderForDay(now: Date, days: ReminderDay): Promise<void> {
    try {
      // Window: accounts created between (days+1) and (days) days ago
      // e.g. day 1 → created 1–2 days ago; day 3 → 3–4 days ago
      const atLeastDaysOld = subDays(now, days);
      const lessThanDaysPlusOneOld = subDays(now, days + 1);
      const dayKey = `day${days}` as 'day1' | 'day3' | 'day7';

      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.isOnboardingComplete = :complete', { complete: false })
        .andWhere('user.isEmailVerified = :verified', { verified: true })
        .andWhere('user.marketingEmailsOptOut = :optOut', { optOut: false })
        .andWhere('(user.accountStatus IS NULL OR user.accountStatus = :active)', {
          active: 'active',
        })
        .andWhere('user.createdAt <= :atLeastDaysOld', { atLeastDaysOld })
        .andWhere('user.createdAt > :lessThanDaysPlusOneOld', { lessThanDaysPlusOneOld })
        .andWhere(
          `(user.onboardingReminderEmailsSent IS NULL OR JSON_EXTRACT(user.onboardingReminderEmailsSent, '$.${dayKey}') IS NULL)`,
        )
        .getMany();

      logger.info(`Found ${users.length} users for day ${days} onboarding reminder`);

      for (const user of users) {
        await this.sendReminderEmail(user, days);
        await this.markReminderSent(user, days);
      }
    } catch (error) {
      logger.error(
        `Error in day ${days} onboarding reminder:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Optional push after the email sequence: day-7 email sent ≥1 day ago,
   * still incomplete, has push token, not yet pushed for this campaign.
   */
  private async sendPostSequencePush(now: Date): Promise<void> {
    try {
      const day7SentBefore = subDays(now, 1);

      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.isOnboardingComplete = :complete', { complete: false })
        .andWhere('(user.accountStatus IS NULL OR user.accountStatus = :active)', {
          active: 'active',
        })
        .andWhere('user.pushToken IS NOT NULL')
        .andWhere('user.pushToken != :empty', { empty: '' })
        .andWhere('user.pushNotificationsEnabled = :enabled', { enabled: true })
        .andWhere('user.onboardingReminderPushSentAt IS NULL')
        .andWhere(
          `JSON_EXTRACT(user.onboardingReminderEmailsSent, '$.day7') IS NOT NULL`,
        )
        .andWhere('user.lastOnboardingReminderEmailSentAt <= :day7SentBefore', {
          day7SentBefore,
        })
        .getMany();

      logger.info(
        `Found ${users.length} users for post-sequence onboarding push`,
      );

      for (const user of users) {
        await this.sendReminderPush(user);
        await this.userRepository.update(user.id, {
          onboardingReminderPushSentAt: new Date(),
        });
      }
    } catch (error) {
      logger.error(
        'Error in sendPostSequencePush:',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async sendReminderEmail(user: User, days: ReminderDay): Promise<void> {
    try {
      const userName = user.firstName
        ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
        : 'there';

      const appLink = APP_DEEP_LINK_ONBOARDING;
      const hasRole = !!user.role;

      const templateMap: Record<ReminderDay, string> = {
        1: 'onboarding-reminder-day1',
        3: 'onboarding-reminder-day3',
        7: 'onboarding-reminder-day7',
      };

      const subjectMap: Record<ReminderDay, string> = {
        1: 'Finish setting up your Spiriment account',
        3: 'Your Spiriment profile is almost ready',
        7: 'Last reminder: complete your Spiriment setup',
      };

      await this.emailService.sendEmailWithTemplate({
        to: user.email,
        subject: subjectMap[days],
        partialName: templateMap[days],
        templateData: {
          title: subjectMap[days],
          userName,
          appLink,
          hasRole,
          role: user.role ?? null,
        },
      });

      logger.info(`Day ${days} onboarding reminder emailed to ${user.email}`);
    } catch (error) {
      logger.error(
        `Error sending day ${days} onboarding reminder to ${user.email}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async sendReminderPush(user: User): Promise<void> {
    try {
      if (!user.pushToken || user.pushNotificationsEnabled === false) {
        return;
      }

      const firstName = user.firstName?.trim();
      const title = firstName
        ? `${firstName}, finish your Spiriment setup`
        : 'Finish your Spiriment setup';
      const body =
        'Your profile is almost ready — tap to pick up where you left off.';

      await pushNotificationService.sendToUser({
        userId: user.id,
        pushToken: user.pushToken,
        title,
        body,
        data: {
          type: 'onboarding_reminder',
          deepLink: APP_DEEP_LINK_ONBOARDING,
        },
        channelId: 'default',
      });

      logger.info(`Onboarding reminder push sent to user ${user.id}`);
    } catch (error) {
      logger.error(
        `Error sending onboarding reminder push to user ${user.id}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async markReminderSent(user: User, days: ReminderDay): Promise<void> {
    try {
      const sent = user.onboardingReminderEmailsSent || {};
      const dayKey = `day${days}` as 'day1' | 'day3' | 'day7';
      sent[dayKey] = new Date();

      await this.userRepository.update(user.id, {
        onboardingReminderEmailsSent: sent,
        lastOnboardingReminderEmailSentAt: new Date(),
      });
    } catch (error) {
      logger.error(
        `Error marking day ${days} onboarding reminder for user ${user.id}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}
