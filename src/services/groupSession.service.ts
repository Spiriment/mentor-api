import { AppDataSource } from '@/config/data-source';
import {
  GroupSession,
  GROUP_SESSION_STATUS,
  GROUP_SESSION_DURATION,
} from '@/database/entities/groupSession.entity';
import {
  GroupSessionParticipant,
  INVITATION_STATUS,
} from '@/database/entities/groupSessionParticipant.entity';
import { User } from '@/database/entities/user.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { USER_ROLE } from '@/common/constants';
import { In, LessThan, MoreThan } from 'typeorm';
import { getEmailService } from './emailHelper';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '@/database/entities/appNotification.entity';

export interface CreateGroupSessionDTO {
  mentorId: string;
  menteeIds: string[]; // 2-5 mentees
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: GROUP_SESSION_DURATION;
}

export interface RespondToInvitationDTO {
  groupSessionId: string;
  menteeId: string;
  accept: boolean;
  declineReason?: string;
}

export interface UpdateGroupSessionDTO {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: GROUP_SESSION_DURATION;
  status?: GROUP_SESSION_STATUS;
}

export class GroupSessionService {
  private groupSessionRepository = AppDataSource.getRepository(GroupSession);
  private participantRepository = AppDataSource.getRepository(GroupSessionParticipant);
  private userRepository = AppDataSource.getRepository(User);
  private sessionRepository = AppDataSource.getRepository(Session);

  /**
   * Get eligible mentees for a mentor (mentees who have completed at least one session)
   */
  async getEligibleMentees(mentorId: string): Promise<User[]> {
    try {
      // Find all completed sessions for this mentor
      const completedSessions = await this.sessionRepository.find({
        where: {
          mentorId,
          status: SESSION_STATUS.COMPLETED,
        },
        relations: ['mentee'],
      });

      // Extract unique mentees
      const menteeMap = new Map<string, User>();
      completedSessions.forEach((session) => {
        if (session.mentee && !menteeMap.has(session.mentee.id)) {
          menteeMap.set(session.mentee.id, session.mentee);
        }
      });

      return Array.from(menteeMap.values());
    } catch (error: any) {
      logger.error('Error getting eligible mentees:', error);
      throw new AppError(
        'Failed to get eligible mentees',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Create a new group session
   */
  async createGroupSession(data: CreateGroupSessionDTO): Promise<GroupSession> {
    try {
      // Validate mentor exists
      const mentor = await this.userRepository.findOne({
        where: { id: data.mentorId, role: USER_ROLE.MENTOR as any },
      });

      if (!mentor) {
        throw new AppError('Mentor not found', StatusCodes.NOT_FOUND);
      }

      // Validate mentee count (2-5)
      if (data.menteeIds.length < 2 || data.menteeIds.length > 5) {
        throw new AppError(
          'Group session must have 2-5 mentees',
          StatusCodes.BAD_REQUEST
        );
      }

      // Validate all mentees exist and are eligible
      const eligibleMentees = await this.getEligibleMentees(data.mentorId);
      const eligibleMenteeIds = eligibleMentees.map((m) => m.id);

      const invalidMentees = data.menteeIds.filter(
        (id) => !eligibleMenteeIds.includes(id)
      );

      if (invalidMentees.length > 0) {
        throw new AppError(
          `Some mentees are not eligible: ${invalidMentees.join(', ')}`,
          StatusCodes.BAD_REQUEST
        );
      }

      // Validate scheduled time is at least 24 hours in advance
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (new Date(data.scheduledAt) < twentyFourHoursFromNow) {
        throw new AppError(
          'Group session must be scheduled at least 24 hours in advance',
          StatusCodes.BAD_REQUEST
        );
      }

      // Check for mentor conflicts with existing sessions and group sessions
      const sessionEndTime = new Date(new Date(data.scheduledAt).getTime() + (data.duration || 60) * 60 * 1000);

      // Check regular sessions
      const conflictingSessions = await this.sessionRepository
        .createQueryBuilder('session')
        .where('session.mentorId = :mentorId', { mentorId: data.mentorId })
        .andWhere('session.status IN (:...statuses)', {
          statuses: ['scheduled', 'confirmed', 'in_progress']
        })
        .andWhere(
          '(session.scheduledAt < :sessionEnd AND DATE_ADD(session.scheduledAt, INTERVAL session.duration MINUTE) > :sessionStart)',
          {
            sessionStart: data.scheduledAt,
            sessionEnd: sessionEndTime,
          }
        )
        .getMany();

      if (conflictingSessions.length > 0) {
        throw new AppError(
          'Mentor has a conflicting session at this time',
          StatusCodes.CONFLICT
        );
      }

      // Check other group sessions
      const conflictingGroupSessions = await this.groupSessionRepository
        .createQueryBuilder('gs')
        .where('gs.mentorId = :mentorId', { mentorId: data.mentorId })
        .andWhere('gs.status IN (:...statuses)', {
          statuses: ['invites_sent', 'confirmed', 'in_progress']
        })
        .andWhere(
          '(gs.scheduledAt < :sessionEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :sessionStart)',
          {
            sessionStart: data.scheduledAt,
            sessionEnd: sessionEndTime,
          }
        )
        .getMany();

      if (conflictingGroupSessions.length > 0) {
        throw new AppError(
          'Mentor has a conflicting group session at this time',
          StatusCodes.CONFLICT
        );
      }

      // Create group session
      const groupSession = this.groupSessionRepository.create({
        mentorId: data.mentorId,
        title: data.title,
        description: data.description,
        scheduledAt: data.scheduledAt,
        duration: data.duration || GROUP_SESSION_DURATION.ONE_HOUR,
        status: GROUP_SESSION_STATUS.INVITES_SENT,
      });

      await this.groupSessionRepository.save(groupSession);

      // Create participant records
      const participants: GroupSessionParticipant[] = [];
      for (const menteeId of data.menteeIds) {
        const participant = this.participantRepository.create({
          groupSessionId: groupSession.id,
          menteeId,
          invitationStatus: INVITATION_STATUS.INVITED,
          invitedAt: new Date(),
        });
        participants.push(participant);
      }

      await this.participantRepository.save(participants);

      // Send invitations
      await this.sendInvitations(groupSession, participants, mentor);

      // Load the full session with participants
      const fullSession = await this.groupSessionRepository.findOne({
        where: { id: groupSession.id },
        relations: ['participants', 'participants.mentee', 'mentor'],
      });

      logger.info(`Group session created: ${groupSession.id}`);
      return fullSession!;
    } catch (error: any) {
      logger.error('Error creating group session:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to create group session',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Send invitations to all participants
   */
  private async sendInvitations(
    groupSession: GroupSession,
    participants: GroupSessionParticipant[],
    mentor: User
  ): Promise<void> {
    const emailService = getEmailService();
    const notificationService = getAppNotificationService();

    for (const participant of participants) {
      const mentee = await this.userRepository.findOne({
        where: { id: participant.menteeId },
      });

      if (!mentee) continue;

      // Send email notification
      try {
        await emailService.sendGroupSessionInvitation({
          to: mentee.email,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          sessionTitle: groupSession.title,
          sessionDescription: groupSession.description || '',
          scheduledAt: groupSession.scheduledAt,
          duration: groupSession.duration,
          groupSessionId: groupSession.id,
          participantId: participant.id,
        });
      } catch (error) {
        logger.error(`Failed to send email invitation to ${mentee.email}:`, error instanceof Error ? error : new Error(String(error)));
      }

      // Send in-app notification
      try {
        await notificationService.createNotification({
          userId: mentee.id,
          type: AppNotificationType.GROUP_SESSION_INVITATION,
          title: 'Group Session Invitation',
          message: `${mentor.firstName} ${mentor.lastName} has invited you to "${groupSession.title}"`,
          data: {
            groupSessionId: groupSession.id,
            participantId: participant.id,
            mentorId: mentor.id,
            scheduledAt: groupSession.scheduledAt,
          },
        });
      } catch (error) {
        logger.error(`Failed to send app notification to ${mentee.id}:`, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  /**
   * Respond to group session invitation
   */
  async respondToInvitation(data: RespondToInvitationDTO): Promise<GroupSessionParticipant> {
    try {
      const participant = await this.participantRepository.findOne({
        where: { groupSessionId: data.groupSessionId, menteeId: data.menteeId },
        relations: ['groupSession', 'groupSession.mentor', 'mentee'],
      });

      if (!participant) {
        throw new AppError('Invitation not found', StatusCodes.NOT_FOUND);
      }

      // Check if can still respond (2 hours before session)
      if (!participant.canRespond(participant.groupSession.scheduledAt)) {
        throw new AppError(
          'Cannot respond to invitation within 2 hours of session start',
          StatusCodes.BAD_REQUEST
        );
      }

      // Update participant status
      participant.invitationStatus = data.accept
        ? INVITATION_STATUS.ACCEPTED
        : INVITATION_STATUS.DECLINED;
      participant.respondedAt = new Date();

      if (!data.accept && data.declineReason) {
        participant.declineReason = data.declineReason;
      }

      await this.participantRepository.save(participant);

      // Send notification to mentor
      const emailService = getEmailService();
      const notificationService = getAppNotificationService();
      const mentor = participant.groupSession.mentor;
      const mentee = participant.mentee;

      if (data.accept) {
        // Accepted
        await emailService.sendGroupSessionAcceptance({
          to: mentor.email,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          sessionTitle: participant.groupSession.title,
        });

        await notificationService.createNotification({
          userId: mentor.id,
          type: AppNotificationType.GROUP_SESSION_RESPONSE,
          title: 'Group Session Accepted',
          message: `${mentee.firstName} ${mentee.lastName} accepted your group session invitation`,
          data: {
            groupSessionId: participant.groupSession.id,
            menteeId: mentee.id,
            accepted: true,
          },
        });
      } else {
        // Declined
        await emailService.sendGroupSessionDecline({
          to: mentor.email,
          mentorName: `${mentor.firstName} ${mentor.lastName}`,
          menteeName: `${mentee.firstName} ${mentee.lastName}`,
          sessionTitle: participant.groupSession.title,
          declineReason: data.declineReason,
        });

        await notificationService.createNotification({
          userId: mentor.id,
          type: AppNotificationType.GROUP_SESSION_RESPONSE,
          title: 'Group Session Declined',
          message: `${mentee.firstName} ${mentee.lastName} declined your group session invitation`,
          data: {
            groupSessionId: participant.groupSession.id,
            menteeId: mentee.id,
            accepted: false,
            declineReason: data.declineReason,
          },
        });
      }

      // Check if we should update session status to confirmed
      await this.checkAndUpdateSessionStatus(participant.groupSession.id);

      logger.info(
        `Participant ${participant.id} responded: ${data.accept ? 'accepted' : 'declined'}`
      );
      return participant;
    } catch (error: any) {
      logger.error('Error responding to invitation:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to respond to invitation',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Check and update session status based on responses
   */
  private async checkAndUpdateSessionStatus(groupSessionId: string): Promise<void> {
    const groupSession = await this.groupSessionRepository.findOne({
      where: { id: groupSessionId },
      relations: ['participants'],
    });

    if (!groupSession) return;

    const acceptedCount = groupSession.participants.filter(
      (p) => p.invitationStatus === INVITATION_STATUS.ACCEPTED
    ).length;

    // If at least 2 accepted, mark as confirmed
    if (
      acceptedCount >= 2 &&
      groupSession.status === GROUP_SESSION_STATUS.INVITES_SENT
    ) {
      groupSession.status = GROUP_SESSION_STATUS.CONFIRMED;
      await this.groupSessionRepository.save(groupSession);
    }
  }

  /**
   * Get group session by ID
   */
  async getGroupSession(id: string, userId: string): Promise<GroupSession> {
    try {
      const groupSession = await this.groupSessionRepository.findOne({
        where: { id },
        relations: ['participants', 'participants.mentee', 'mentor'],
      });

      if (!groupSession) {
        throw new AppError('Group session not found', StatusCodes.NOT_FOUND);
      }

      // Check if user is mentor or participant
      const isMentor = groupSession.mentorId === userId;
      const isParticipant = groupSession.participants.some(
        (p) => p.menteeId === userId
      );

      if (!isMentor && !isParticipant) {
        throw new AppError('Unauthorized', StatusCodes.FORBIDDEN);
      }

      return groupSession;
    } catch (error: any) {
      logger.error('Error getting group session:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to get group session',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get mentor's group sessions
   */
  async getMentorGroupSessions(
    mentorId: string,
    filters?: {
      status?: GROUP_SESSION_STATUS;
      upcoming?: boolean;
      past?: boolean;
    }
  ): Promise<GroupSession[]> {
    try {
      const where: any = { mentorId };

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.upcoming) {
        where.scheduledAt = MoreThan(new Date());
      }

      if (filters?.past) {
        where.scheduledAt = LessThan(new Date());
      }

      const groupSessions = await this.groupSessionRepository.find({
        where,
        relations: ['participants', 'participants.mentee'],
        order: { scheduledAt: 'DESC' },
      });

      return groupSessions;
    } catch (error: any) {
      logger.error('Error getting mentor group sessions:', error);
      throw new AppError(
        'Failed to get group sessions',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get mentee's group session invitations
   */
  async getMenteeInvitations(
    menteeId: string,
    filters?: {
      status?: INVITATION_STATUS;
      upcoming?: boolean;
    }
  ): Promise<GroupSessionParticipant[]> {
    try {
      const where: any = { menteeId };

      if (filters?.status) {
        where.invitationStatus = filters.status;
      }

      const participants = await this.participantRepository.find({
        where,
        relations: ['groupSession', 'groupSession.mentor', 'groupSession.participants'],
      });

      // Filter by upcoming if needed
      if (filters?.upcoming) {
        return participants.filter(
          (p) => new Date(p.groupSession.scheduledAt) > new Date()
        );
      }

      return participants;
    } catch (error: any) {
      logger.error('Error getting mentee invitations:', error);
      throw new AppError(
        'Failed to get invitations',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Cancel group session
   */
  async cancelGroupSession(
    id: string,
    mentorId: string,
    cancellationReason?: string
  ): Promise<GroupSession> {
    try {
      const groupSession = await this.groupSessionRepository.findOne({
        where: { id, mentorId },
        relations: ['participants', 'participants.mentee', 'mentor'],
      });

      if (!groupSession) {
        throw new AppError('Group session not found', StatusCodes.NOT_FOUND);
      }

      if (groupSession.status === GROUP_SESSION_STATUS.COMPLETED) {
        throw new AppError(
          'Cannot cancel completed session',
          StatusCodes.BAD_REQUEST
        );
      }

      groupSession.status = GROUP_SESSION_STATUS.CANCELLED;
      groupSession.cancelledAt = new Date();
      groupSession.cancellationReason = cancellationReason;

      await this.groupSessionRepository.save(groupSession);

      // Notify all participants
      await this.sendCancellationNotifications(groupSession);

      logger.info(`Group session cancelled: ${id}`);
      return groupSession;
    } catch (error: any) {
      logger.error('Error cancelling group session:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to cancel group session',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Send cancellation notifications
   */
  private async sendCancellationNotifications(
    groupSession: GroupSession
  ): Promise<void> {
    const emailService = getEmailService();
    const notificationService = getAppNotificationService();

    for (const participant of groupSession.participants) {
      if (participant.invitationStatus === INVITATION_STATUS.ACCEPTED) {
        const mentee = participant.mentee;

        // Send email
        try {
          await emailService.sendGroupSessionCancellation({
            to: mentee.email,
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            mentorName: `${groupSession.mentor.firstName} ${groupSession.mentor.lastName}`,
            sessionTitle: groupSession.title,
            cancellationReason: groupSession.cancellationReason,
          });
        } catch (error) {
          logger.error(`Failed to send cancellation email to ${mentee.email}:`, error instanceof Error ? error : new Error(String(error)));
        }

        // Send in-app notification
        try {
          await notificationService.createNotification({
            userId: mentee.id,
            type: AppNotificationType.GROUP_SESSION_CANCELLED,
            title: 'Group Session Cancelled',
            message: `The group session "${groupSession.title}" has been cancelled`,
            data: {
              groupSessionId: groupSession.id,
              cancellationReason: groupSession.cancellationReason,
            },
          });
        } catch (error) {
          logger.error(`Failed to send cancellation notification to ${mentee.id}:`, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }

  /**
   * Start group session
   */
  async startGroupSession(id: string, mentorId: string): Promise<GroupSession> {
    try {
      const groupSession = await this.groupSessionRepository.findOne({
        where: { id, mentorId },
      });

      if (!groupSession) {
        throw new AppError('Group session not found', StatusCodes.NOT_FOUND);
      }

      if (!groupSession.canStart()) {
        throw new AppError(
          'Session cannot be started (needs at least 2 accepted participants)',
          StatusCodes.BAD_REQUEST
        );
      }

      groupSession.status = GROUP_SESSION_STATUS.IN_PROGRESS;
      groupSession.startedAt = new Date();

      await this.groupSessionRepository.save(groupSession);

      logger.info(`Group session started: ${id}`);
      return groupSession;
    } catch (error: any) {
      logger.error('Error starting group session:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to start group session',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * End group session
   */
  async endGroupSession(id: string, mentorId: string): Promise<GroupSession> {
    try {
      const groupSession = await this.groupSessionRepository.findOne({
        where: { id, mentorId },
      });

      if (!groupSession) {
        throw new AppError('Group session not found', StatusCodes.NOT_FOUND);
      }

      groupSession.status = GROUP_SESSION_STATUS.COMPLETED;
      groupSession.endedAt = new Date();

      await this.groupSessionRepository.save(groupSession);

      logger.info(`Group session ended: ${id}`);
      return groupSession;
    } catch (error: any) {
      logger.error('Error ending group session:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to end group session',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Update group session
   */
  async updateGroupSession(
    id: string,
    mentorId: string,
    updates: UpdateGroupSessionDTO
  ): Promise<GroupSession> {
    try {
      const groupSession = await this.groupSessionRepository.findOne({
        where: { id, mentorId },
      });

      if (!groupSession) {
        throw new AppError('Group session not found', StatusCodes.NOT_FOUND);
      }

      // Cannot update completed or cancelled sessions
      if (
        groupSession.status === GROUP_SESSION_STATUS.COMPLETED ||
        groupSession.status === GROUP_SESSION_STATUS.CANCELLED
      ) {
        throw new AppError(
          'Cannot update completed or cancelled session',
          StatusCodes.BAD_REQUEST
        );
      }

      // Validate scheduled time if being updated
      if (updates.scheduledAt) {
        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        if (new Date(updates.scheduledAt) < twentyFourHoursFromNow) {
          throw new AppError(
            'Group session must be scheduled at least 24 hours in advance',
            StatusCodes.BAD_REQUEST
          );
        }
      }

      // Apply updates
      Object.assign(groupSession, updates);

      await this.groupSessionRepository.save(groupSession);

      logger.info(`Group session updated: ${id}`);
      return groupSession;
    } catch (error: any) {
      logger.error('Error updating group session:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to update group session',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Submit session summary (mentee only)
   */
  async submitSessionSummary(
    groupSessionId: string,
    menteeId: string,
    summary: string
  ): Promise<GroupSessionParticipant> {
    try {
      const participant = await this.participantRepository.findOne({
        where: { groupSessionId, menteeId },
        relations: ['groupSession'],
      });

      if (!participant) {
        throw new AppError('Participant not found', StatusCodes.NOT_FOUND);
      }

      // Can only submit summary for completed sessions
      if (participant.groupSession.status !== GROUP_SESSION_STATUS.COMPLETED) {
        throw new AppError(
          'Can only submit summary for completed sessions',
          StatusCodes.BAD_REQUEST
        );
      }

      // Can only submit if accepted the invitation
      if (participant.invitationStatus !== INVITATION_STATUS.ACCEPTED) {
        throw new AppError(
          'Can only submit summary if you accepted the invitation',
          StatusCodes.BAD_REQUEST
        );
      }

      participant.sessionSummary = summary;
      participant.summarySubmittedAt = new Date();

      await this.participantRepository.save(participant);

      logger.info(`Session summary submitted by ${menteeId} for session ${groupSessionId}`);
      return participant;
    } catch (error: any) {
      logger.error('Error submitting session summary:', error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Failed to submit session summary',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}
