import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { GroupSession, GROUP_SESSION_STATUS } from '@/database/entities/groupSession.entity';
import { Message, MESSAGE_TYPE } from '@/database/entities/message.entity';
import { Conversation, CONVERSATION_TYPE } from '@/database/entities/conversation.entity';
import { logger } from '@/config/int-services';
import { getEmailService } from './emailHelper';
import { pushNotificationService } from './pushNotification.service';
import { format } from 'date-fns';
import { StreamService } from '@/core/stream.service';

const streamService = new StreamService();

export class SessionAutoUpdateService {
  private sessionRepo = AppDataSource.getRepository(Session);
  private groupSessionRepo = AppDataSource.getRepository(GroupSession);
  private messageRepo = AppDataSource.getRepository(Message);
  private conversationRepo = AppDataSource.getRepository(Conversation);

  /**
   * Check for missed sessions and update their status
   * Runs periodically via cron
   */
  async checkMissedSessions(): Promise<void> {
    try {
      logger.info('Starting missed sessions check...');
      
      await this.processMissedOneOnOneSessions();
      await this.processMissedGroupSessions();
      await this.processStaleInProgressSessions();
      
      logger.info('Missed sessions check completed.');
    } catch (error) {
      logger.error('Error during missed sessions check:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Process sessions that are stuck in 'in_progress' status
   * but their scheduled time has passed.
   */
  private async processStaleInProgressSessions(): Promise<void> {
    try {
      // Find sessions stuck in 'in_progress' that should have ended by now
      // Buffer of 30 minutes after scheduled end time
      const staleSessions = await this.sessionRepo.createQueryBuilder('session')
        .where('session.status = :status', { status: SESSION_STATUS.IN_PROGRESS })
        .andWhere(
          'DATE_ADD(session.scheduledAt, INTERVAL (session.duration + 30) MINUTE) < :now',
          { now: new Date() }
        )
        .getMany();

      if (staleSessions.length === 0) return;

      logger.info(`Found ${staleSessions.length} stale in-progress sessions.`);

      for (const session of staleSessions) {
        try {
          // Sanitize session ID for Stream call ID (standard alphanumeric, underscore, hyphen)
          const callId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
          const callReport = await streamService.getCallSessionReport(callId);

          let finalStatus = SESSION_STATUS.COMPLETED;
          
          if (callReport && callReport.session) {
            const participants = callReport.session.participants || [];
            const mentorJoined = participants.some((p: any) => p.user_id === session.mentorId);
            const menteeJoined = participants.some((p: any) => p.user_id === session.menteeId);

            // Logic: If mentee never joined, it's a NO_SHOW
            if (!menteeJoined) {
              finalStatus = SESSION_STATUS.NO_SHOW;
              logger.info(`Stale session ${session.id}: Mentee never joined. Marking as NO_SHOW.`);
            } else if (!mentorJoined) {
              // If mentor never joined but mentee did, it might be a no-show for mentor
              // but for now we follow the user's request "no show if the mentee and mentor were not in the call"
              finalStatus = SESSION_STATUS.NO_SHOW;
              logger.info(`Stale session ${session.id}: Mentor never joined. Marking as NO_SHOW.`);
            } else {
              logger.info(`Stale session ${session.id}: Both participants recorded. Marking as COMPLETED.`);
            }
          } else {
            // No call report found means no session ever really happened on Stream
            finalStatus = SESSION_STATUS.NO_SHOW;
            logger.info(`Stale session ${session.id}: No Stream call session found. Marking as NO_SHOW.`);
          }

          session.status = finalStatus;
          session.endedAt = session.endedAt || new Date(); // Use existing endedAt or current time
          await this.sessionRepo.save(session);

        } catch (err) {
          logger.error(`Failed to process stale session ${session.id}:`, err instanceof Error ? err : new Error(String(err)));
        }
      }
    } catch (error) {
      logger.error('Error processing stale in-progress sessions:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async processMissedOneOnOneSessions(): Promise<void> {
    const missedSessions = await this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.mentor', 'mentor')
      .leftJoinAndSelect('session.mentee', 'mentee')
      .where('session.status IN (:...statuses)', {
        statuses: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED],
      })
      .andWhere(
        'DATE_ADD(session.scheduledAt, INTERVAL (session.duration + 30) MINUTE) < :now',
        { now: new Date() }
      )
      .getMany();

    if (missedSessions.length === 0) return;

    logger.info(`Found ${missedSessions.length} missed one-on-one sessions.`);

    const emailService = getEmailService();

    for (const session of missedSessions) {
      try {
        session.status = SESSION_STATUS.NO_SHOW;
        await this.sessionRepo.save(session);

        const scheduledTimeFormatted = format(new Date(session.scheduledAt), 'PPPPp');

        // 1. Send emails
        if (session.mentee.email) {
          await emailService.sendMissedSessionEmail({
            to: session.mentee.email,
            userName: session.mentee.firstName || session.mentee.email,
            sessionTitle: session.title || 'Mentorship Session',
            scheduledTime: scheduledTimeFormatted,
            sessionId: session.id,
          });
        }

        if (session.mentor.email) {
          await emailService.sendMissedSessionEmail({
            to: session.mentor.email,
            userName: session.mentor.firstName || session.mentor.email,
            sessionTitle: session.title || 'Mentorship Session',
            scheduledTime: scheduledTimeFormatted,
            sessionId: session.id,
          });
        }

        // 2. Send push notifications
        if (session.mentee.pushToken) {
          await pushNotificationService.sendMissedSessionNotification(
            session.mentee.pushToken,
            session.mentee.id,
            session.title || 'Mentorship Session',
            scheduledTimeFormatted,
            session.id
          );
        }

        if (session.mentor.pushToken) {
          await pushNotificationService.sendMissedSessionNotification(
            session.mentor.pushToken,
            session.mentor.id,
            session.title || 'Mentorship Session',
            scheduledTimeFormatted,
            session.id
          );
        }

        // 3. Send system message in chat
        await this.sendSystemMessage(
          [session.mentee.id, session.mentor.id],
          `The session scheduled for ${scheduledTimeFormatted} was missed. Would you like to reschedule?`
        );

      } catch (err) {
        logger.error(`Failed to process missed session ${session.id}:`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private async processMissedGroupSessions(): Promise<void> {
    const missedGroupSessions = await this.groupSessionRepo.createQueryBuilder('gs')
      .leftJoinAndSelect('gs.mentor', 'mentor')
      .leftJoinAndSelect('gs.participants', 'participants')
      .leftJoinAndSelect('participants.mentee', 'mentee')
      .where('gs.status IN (:...statuses)', {
        statuses: [GROUP_SESSION_STATUS.INVITES_SENT, GROUP_SESSION_STATUS.CONFIRMED],
      })
      .andWhere(
        'DATE_ADD(gs.scheduledAt, INTERVAL (gs.duration + 30) MINUTE) < :now',
        { now: new Date() }
      )
      .getMany();

    if (missedGroupSessions.length === 0) return;

    logger.info(`Found ${missedGroupSessions.length} missed group sessions.`);

    const emailService = getEmailService();

    for (const gs of missedGroupSessions) {
      try {
        gs.status = GROUP_SESSION_STATUS.MISSED;
        await this.groupSessionRepo.save(gs);

        const scheduledTimeFormatted = format(new Date(gs.scheduledAt), 'PPPPp');

        // Notify mentor
        if (gs.mentor.email) {
          await emailService.sendMissedSessionEmail({
            to: gs.mentor.email,
            userName: gs.mentor.firstName || gs.mentor.email,
            sessionTitle: gs.title,
            scheduledTime: scheduledTimeFormatted,
            sessionId: gs.id,
          });
        }

        if (gs.mentor.pushToken) {
          await pushNotificationService.sendMissedSessionNotification(
            gs.mentor.pushToken,
            gs.mentor.id,
            gs.title,
            scheduledTimeFormatted,
            gs.id
          );
        }

        // Notify participants
        for (const participant of gs.participants) {
          const mentee = participant.mentee;
          if (mentee.email) {
            await emailService.sendMissedSessionEmail({
              to: mentee.email,
              userName: mentee.firstName || mentee.email,
              sessionTitle: gs.title,
              scheduledTime: scheduledTimeFormatted,
              sessionId: gs.id,
            });
          }
          if (mentee.pushToken) {
            await pushNotificationService.sendMissedSessionNotification(
              mentee.pushToken,
              mentee.id,
              gs.title,
              scheduledTimeFormatted,
              gs.id
            );
          }
        }
        
        // System message in group chat if it exists
        if (gs.conversationId) {
             const message = this.messageRepo.create({
                conversationId: gs.conversationId,
                senderId: gs.mentorId, // System messages often use a bot or one of the participants as sender in simple systems
                type: MESSAGE_TYPE.SYSTEM,
                content: `The group session "${gs.title}" scheduled for ${scheduledTimeFormatted} was missed.`,
                status: 'sent' as any
            });
            await this.messageRepo.save(message);
        }

      } catch (err) {
        logger.error(`Failed to process missed group session ${gs.id}:`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private async sendSystemMessage(userIds: string[], text: string): Promise<void> {
    try {
      // Find a private conversation between these users
      // This is a simplified approach, assuming 1-on-1 for private sessions
      if (userIds.length !== 2) return;

      const conversation = await this.conversationRepo
        .createQueryBuilder('conversation')
        .innerJoin('conversation.participants', 'p1', 'p1.userId = :u1', { u1: userIds[0] })
        .innerJoin('conversation.participants', 'p2', 'p2.userId = :u2', { u2: userIds[1] })
        .where('conversation.type = :type', { type: CONVERSATION_TYPE.MENTOR_MENTEE })
        .getOne();

      if (conversation) {
        const message = this.messageRepo.create({
          conversationId: conversation.id,
          senderId: userIds[0], // Arbitrary, since it's a system message
          type: MESSAGE_TYPE.SYSTEM,
          content: text,
          status: 'sent' as any
        });
        await this.messageRepo.save(message);
      }
    } catch (err) {
      logger.error('Error sending system message:', err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export const sessionAutoUpdateService = new SessionAutoUpdateService();
