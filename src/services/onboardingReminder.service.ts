import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { APP_DEEP_LINK_ONBOARDING } from '@/common/constants/appDeepLinks';
import { subDays } from 'date-fns';

type ReminderDay = 1 | 3 | 7;

/**
 * Email users who signed up but never finished onboarding.
 * Sequence: ~1 day, ~3 days, ~7 days after account creation, then stop.
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
