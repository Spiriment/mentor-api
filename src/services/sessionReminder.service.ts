import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { addMinutes, format } from 'date-fns';

export class SessionReminderService {
  private sessionRepository = AppDataSource.getRepository(Session);
  private userRepository = AppDataSource.getRepository(User);
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  /**
   * Send 15-minute reminders for upcoming sessions
   * This method is called by the cron job
   */
  async send15MinuteReminders(): Promise<void> {
    try {
      const now = new Date();
      const in15Minutes = addMinutes(now, 15);

      // Find sessions that start in approximately 15 minutes
      // We check for sessions between 14 and 16 minutes from now to account for cron timing
      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentor', 'mentor')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.status IN (:...statuses)', {
          statuses: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED],
        })
        .andWhere('session.scheduledAt >= :startTime', {
          startTime: addMinutes(now, 14),
        })
        .andWhere('session.scheduledAt <= :endTime', {
          endTime: addMinutes(now, 16),
        })
        .getMany();

      logger.info(`Found ${sessions.length} sessions starting in ~15 minutes`);

      for (const session of sessions) {
        // Check if reminder already sent
        if (session.reminders?.sent15min) {
          logger.debug(
            `15-minute reminder already sent for session ${session.id}`
          );
          continue;
        }

        try {
          // Send reminder to mentor
          if (session.mentor) {
            await this.sendReminderToMentor(session);
          }

          // Send reminder to mentee
          if (session.mentee) {
            await this.sendReminderToMentee(session);
          }

          // Update session reminders field
          await this.updateSessionReminders(session.id, {
            sent15min: true,
          });

          logger.info(`15-minute reminder sent for session ${session.id}`);
        } catch (error) {
          logger.error(
            `Error sending 15-minute reminder for session ${session.id}:`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    } catch (error) {
      logger.error(
        'Error in send15MinuteReminders:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send reminder email to mentor
   */
  private async sendReminderToMentor(session: Session): Promise<void> {
    const mentor = session.mentor;
    if (!mentor || !mentor.email) {
      logger.warn(`Mentor email not found for session ${session.id}`);
      return;
    }

    const scheduledTime = new Date(session.scheduledAt);
    const formattedTime = format(
      scheduledTime,
      'EEEE, MMMM d, yyyy "at" h:mm a'
    );
    const menteeName = session.mentee
      ? `${session.mentee.firstName || ''} ${
          session.mentee.lastName || ''
        }`.trim() || session.mentee.email
      : 'Your mentee';

    const message =
      `You have a mentorship session scheduled in 15 minutes!\n\n` +
      `Session Details:\n` +
      `- Time: ${formattedTime}\n` +
      `- With: ${menteeName}\n` +
      `- Duration: ${session.duration} minutes\n` +
      `${
        session.description ? `- Description: ${session.description}\n` : ''
      }` +
      `${session.location ? `- Location: ${session.location}\n` : ''}\n` +
      `\nPlease open the Mentor App to start your session and connect with ${menteeName} via chat or call.`;

    await this.emailService.sendNotificationEmail({
      to: mentor.email,
      subject: `⏰ Session Reminder: Your session starts in 15 minutes`,
      message,
      userName: mentor.firstName || mentor.email,
      // No actionUrl - users should open the app instead
    });

    logger.info(
      `15-minute reminder email sent to mentor ${mentor.email} for session ${session.id}`
    );
  }

  /**
   * Send reminder email to mentee
   */
  private async sendReminderToMentee(session: Session): Promise<void> {
    const mentee = session.mentee;
    if (!mentee || !mentee.email) {
      logger.warn(`Mentee email not found for session ${session.id}`);
      return;
    }

    const scheduledTime = new Date(session.scheduledAt);
    const formattedTime = format(
      scheduledTime,
      'EEEE, MMMM d, yyyy "at" h:mm a'
    );
    const mentorName = session.mentor
      ? `${session.mentor.firstName || ''} ${
          session.mentor.lastName || ''
        }`.trim() || session.mentor.email
      : 'Your mentor';

    const message =
      `You have a mentorship session scheduled in 15 minutes!\n\n` +
      `Session Details:\n` +
      `- Time: ${formattedTime}\n` +
      `- With: ${mentorName}\n` +
      `- Duration: ${session.duration} minutes\n` +
      `${
        session.description ? `- Description: ${session.description}\n` : ''
      }` +
      `${session.location ? `- Location: ${session.location}\n` : ''}\n` +
      `\nPlease open the Mentor App to start your session and connect with ${mentorName} via chat or call.`;

    await this.emailService.sendNotificationEmail({
      to: mentee.email,
      subject: `⏰ Session Reminder: Your session starts in 15 minutes`,
      message,
      userName: mentee.firstName || mentee.email,
      // No actionUrl - users should open the app instead
    });

    logger.info(
      `15-minute reminder email sent to mentee ${mentee.email} for session ${session.id}`
    );
  }

  /**
   * Update session reminders field
   */
  private async updateSessionReminders(
    sessionId: string,
    reminderUpdate: {
      sent15min?: boolean;
      sent1h?: boolean;
      sent24h?: boolean;
    }
  ): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      logger.warn(`Session ${sessionId} not found when updating reminders`);
      return;
    }

    const currentReminders = session.reminders || {};
    const updatedReminders = {
      ...currentReminders,
      ...reminderUpdate,
    };

    await this.sessionRepository.update(sessionId, {
      reminders: updatedReminders,
    });

    logger.debug(
      `Updated reminders for session ${sessionId}`,
      updatedReminders
    );
  }
}
