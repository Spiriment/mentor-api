import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { GroupSession, GROUP_SESSION_STATUS } from '@/database/entities/groupSession.entity';
import { Message, MESSAGE_TYPE } from '@/database/entities/message.entity';
import { Conversation, CONVERSATION_TYPE } from '@/database/entities/conversation.entity';
import { logger } from '@/config/int-services';
import { getEmailService } from './emailHelper';
import { pushNotificationService } from './pushNotification.service';
import { subMinutes, format } from 'date-fns';
import { In, LessThan } from 'typeorm';

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
      
      logger.info('Missed sessions check completed.');
    } catch (error) {
      logger.error('Error during missed sessions check:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async processMissedOneOnOneSessions(): Promise<void> {
    // A session is missed if it's past its scheduled end time and hasn't started
    // We check sessions scheduled more than (duration) minutes ago
    // For simplicity, we'll check sessions scheduled more than 2 hours ago that are still in 'scheduled' or 'confirmed' status
    
    const twoHoursAgo = subMinutes(new Date(), 120);
    
    const missedSessions = await this.sessionRepo.find({
      where: {
        status: In([SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED]),
        scheduledAt: LessThan(twoHoursAgo),
      },
      relations: ['mentor', 'mentee'],
    });

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
    const twoHoursAgo = subMinutes(new Date(), 120);
    
    const missedGroupSessions = await this.groupSessionRepo.find({
      where: {
        status: In([GROUP_SESSION_STATUS.INVITES_SENT, GROUP_SESSION_STATUS.CONFIRMED]),
        scheduledAt: LessThan(twoHoursAgo),
      },
      relations: ['mentor', 'participants', 'participants.mentee'],
    });

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
