import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { EmailService } from '@/core/email.service';
import { pushNotificationService } from './pushNotification.service';
import { addMinutes, format } from 'date-fns';

export class SessionReminderService {
  private sessionRepository = AppDataSource.getRepository(Session);
  private userRepository = AppDataSource.getRepository(User);
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  /**
   * Send 1-hour reminders for upcoming sessions
   * This method is called by the cron job
   */
  async send1HourReminders(): Promise<void> {
    try {
      const now = new Date();

      // Find sessions that start in approximately 1 hour
      // We check for sessions between 59 and 61 minutes from now to account for cron timing
      const startTime = addMinutes(now, 59);
      const endTime = addMinutes(now, 61);

      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .select([
          'session.id',
          'session.mentorId',
          'session.menteeId',
          'session.status',
          'session.type',
          'session.duration',
          'session.scheduledAt',
          'session.title',
          'session.description',
          'session.location',
          'session.reminders',
        ])
        .leftJoinAndSelect('session.mentor', 'mentor')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.status IN (:...statuses)', {
          statuses: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED],
        })
        .andWhere('session.scheduledAt >= :startTime', {
          startTime: startTime,
        })
        .andWhere('session.scheduledAt <= :endTime', {
          endTime: endTime,
        })
        .getMany();

      logger.info(`Found ${sessions.length} sessions starting in ~1 hour`);

      for (const session of sessions) {
        // Check if 1-hour reminder already sent
        if (session.reminders?.sent1h) {
          logger.debug(
            `1-hour reminder already sent for session ${session.id}`
          );
          continue;
        }

        try {
          // Send reminder to mentor
          if (session.mentor) {
            await this.sendReminderToMentor(session, '1 hour');
          }

          // Send reminder to mentee
          if (session.mentee) {
            await this.sendReminderToMentee(session, '1 hour');
          }

          // Update session reminders field
          await this.updateSessionReminders(session.id, {
            sent1h: true,
          });

          logger.info(`1-hour reminder sent for session ${session.id}`);
        } catch (error) {
          logger.error(
            `Error sending 1-hour reminder for session ${session.id}:`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    } catch (error) {
      logger.error(
        'Error in send1HourReminders:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
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
      const startTime = addMinutes(now, 14);
      const endTime = addMinutes(now, 16);
      
      // Use QueryBuilder with explicit select to avoid selecting columns that might not exist
      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .select([
          'session.id',
          'session.mentorId',
          'session.menteeId',
          'session.status',
          'session.type',
          'session.duration',
          'session.scheduledAt',
          'session.title',
          'session.description',
          'session.location',
          'session.reminders',
        ])
        .leftJoinAndSelect('session.mentor', 'mentor')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.status IN (:...statuses)', {
          statuses: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED],
        })
        .andWhere('session.scheduledAt >= :startTime', {
          startTime: startTime,
        })
        .andWhere('session.scheduledAt <= :endTime', {
          endTime: endTime,
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
            await this.sendReminderToMentor(session, '15 minutes');
          }

          // Send reminder to mentee
          if (session.mentee) {
            await this.sendReminderToMentee(session, '15 minutes');
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
  private async sendReminderToMentor(
    session: Session,
    timeUntil: string
  ): Promise<void> {
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

    const mentorName = `${mentor.firstName || ''} ${mentor.lastName || ''}`.trim() || mentor.email;

    // Format session type for display
    const sessionTypeMap: Record<string, string> = {
      one_on_one: 'One-on-One',
      group: 'Group Session',
      video_call: 'Video Call',
      phone_call: 'Phone Call',
      in_person: 'In-Person',
    };
    const sessionType = sessionTypeMap[session.type] || session.type;

    // Send email reminder
    await this.emailService.sendSessionReminderEmail(
      mentor.email,
      mentorName,
      menteeName,
      formattedTime,
      session.duration,
      timeUntil,
      'mentee',
      session.description,
      sessionType,
      session.location
    );

    logger.info(
      `${timeUntil} reminder email sent to mentor ${mentor.email} for session ${session.id}`
    );

    // Send push notification if mentor has a push token
    if (mentor.pushToken) {
      const minutesBefore = timeUntil === '1 hour' ? 60 : 15;
      await pushNotificationService.sendSessionReminder(
        mentor.pushToken,
        mentor.id,
        menteeName,
        formattedTime,
        minutesBefore
      );
      logger.info(
        `${timeUntil} push notification sent to mentor ${mentor.email} for session ${session.id}`
      );
    }
  }

  /**
   * Send reminder email to mentee
   */
  private async sendReminderToMentee(
    session: Session,
    timeUntil: string
  ): Promise<void> {
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

    const menteeName = `${mentee.firstName || ''} ${mentee.lastName || ''}`.trim() || mentee.email;

    // Format session type for display
    const sessionTypeMap: Record<string, string> = {
      one_on_one: 'One-on-One',
      group: 'Group Session',
      video_call: 'Video Call',
      phone_call: 'Phone Call',
      in_person: 'In-Person',
    };
    const sessionType = sessionTypeMap[session.type] || session.type;

    // Send email reminder
    await this.emailService.sendSessionReminderEmail(
      mentee.email,
      menteeName,
      mentorName,
      formattedTime,
      session.duration,
      timeUntil,
      'mentor',
      session.description,
      sessionType,
      session.location
    );

    logger.info(
      `${timeUntil} reminder email sent to mentee ${mentee.email} for session ${session.id}`
    );

    // Send push notification if mentee has a push token
    if (mentee.pushToken) {
      const minutesBefore = timeUntil === '1 hour' ? 60 : 15;
      await pushNotificationService.sendSessionReminder(
        mentee.pushToken,
        mentee.id,
        mentorName,
        formattedTime,
        minutesBefore
      );
      logger.info(
        `${timeUntil} push notification sent to mentee ${mentee.email} for session ${session.id}`
      );
    }
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
