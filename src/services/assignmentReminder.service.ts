import { DataSource } from 'typeorm';
import { Session, SESSION_STATUS } from '../database/entities/session.entity';
import { EmailService } from '../core/email.service';
import { logger } from '../config/int-services';
import { format, subHours } from 'date-fns';

export class AssignmentReminderService {
  constructor(
    private dataSource: DataSource,
    private emailService: EmailService
  ) {}

  /**
   * Finds completed sessions with no assignments that ended ~24 hours ago
   * and sends a one-time reminder email to the mentor.
   */
  async sendAssignmentReminders(): Promise<void> {
    const now = new Date();
    const windowStart = subHours(now, 25);
    const windowEnd = subHours(now, 23);

    const sessionRepo = this.dataSource.getRepository(Session);

    const sessions = await sessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.mentor', 'mentor')
      .leftJoinAndSelect('session.mentee', 'mentee')
      .where('session.status = :status', { status: SESSION_STATUS.COMPLETED })
      .andWhere('session.endedAt BETWEEN :windowStart AND :windowEnd', {
        windowStart,
        windowEnd,
      })
      .andWhere(
        '(session.assignments IS NULL OR JSON_LENGTH(session.assignments) = 0)'
      )
      .andWhere(
        "(session.reminders IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(session.reminders, '$.sentAssignmentReminder')) IS NULL)"
      )
      .getMany();

    logger.info(
      `Assignment reminder: found ${sessions.length} session(s) without assignments`
    );

    for (const session of sessions) {
      try {
        const mentorEmail = session.mentor?.email;
        const mentorName =
          [session.mentor?.firstName, session.mentor?.lastName]
            .filter(Boolean)
            .join(' ') || 'Mentor';
        const menteeName =
          [session.mentee?.firstName, session.mentee?.lastName]
            .filter(Boolean)
            .join(' ') || 'your mentee';
        const sessionDate = session.endedAt
          ? format(session.endedAt, "EEEE, MMMM d, yyyy 'at' h:mm a")
          : format(session.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a");

        if (!mentorEmail) {
          logger.warn(`No email for mentor on session ${session.id}, skipping`);
          continue;
        }

        await this.emailService.sendAssignmentReminderEmail({
          to: mentorEmail,
          mentorName,
          menteeName,
          sessionDate,
          sessionId: session.id,
        });

        // Mark reminder as sent to prevent duplicates on subsequent runs
        session.reminders = { ...session.reminders, sentAssignmentReminder: true };
        await sessionRepo.save(session);

        logger.info(
          `Assignment reminder sent to ${mentorEmail} for session ${session.id}`
        );
      } catch (error) {
        logger.error(
          `Failed to send assignment reminder for session ${session.id}:`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }
}
