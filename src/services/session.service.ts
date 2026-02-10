import { AppDataSource } from '@/config/data-source';
import {
  Session,
  SESSION_STATUS,
  SESSION_TYPE,
  SESSION_DURATION,
} from '@/database/entities/session.entity';
import {
  MentorAvailability,
  DAY_OF_WEEK,
  AVAILABILITY_STATUS,
} from '@/database/entities/mentorAvailability.entity';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { USER_ROLE } from '@/common/constants';
import { format, addMinutes, subMinutes } from 'date-fns';
import { toZonedTime, format as formatTz } from 'date-fns-tz';
import { Between, In } from 'typeorm';
import {
  getEmailService,
  formatSessionTime,
  formatSessionType,
} from './emailHelper';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '@/database/entities/appNotification.entity';
import { pushNotificationService } from './pushNotification.service';
import {
  MentorshipRequest,
  MENTORSHIP_REQUEST_STATUS,
} from '@/database/entities/mentorshipRequest.entity';
import { GroupSession } from '@/database/entities/groupSession.entity';

export interface CreateSessionDTO {
  mentorId: string;
  menteeId: string;
  scheduledAt: Date;
  type?: SESSION_TYPE;
  duration?: SESSION_DURATION;
  title?: string;
  description?: string;
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  location?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
}

export interface UpdateSessionDTO {
  startedAt?: Date | string;
  endedAt?: Date | string;
  scheduledAt?: Date;
  type?: SESSION_TYPE;
  duration?: SESSION_DURATION;
  title?: string;
  description?: string;
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  location?: string;
  mentorNotes?: string;
  menteeNotes?: string;
  sessionNotes?: string;
  sessionSummary?: string;
  assignments?: string[];
  status?: SESSION_STATUS;
}

export interface CreateAvailabilityDTO {
  mentorId: string;
  dayOfWeek: DAY_OF_WEEK;
  startTime: string;
  endTime: string;
  slotDuration?: number;
  timezone: string;
  specificDate?: Date;
  breaks?: Array<{
    startTime: string;
    endTime: string;
    reason?: string;
  }>;
  notes?: string;
}

export class SessionService {
  private sessionRepository = AppDataSource.getRepository(Session);
  private availabilityRepository =
    AppDataSource.getRepository(MentorAvailability);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Create a new session
   */
  async createSession(data: CreateSessionDTO): Promise<Session> {
    try {
      // Validate mentor and mentee exist
      const mentor = await this.userRepository.findOne({
        where: { id: data.mentorId, role: USER_ROLE.MENTOR as any },
      });

      if (!mentor) {
        throw new AppError('Mentor not found', StatusCodes.NOT_FOUND);
      }

      const mentee = await this.userRepository.findOne({
        where: { id: data.menteeId, role: USER_ROLE.MENTEE as any },
      });

      if (!mentee) {
        throw new AppError('Mentee not found', StatusCodes.NOT_FOUND);
      }

      // 1. Verify mentorship status
      const mentorshipRequest = await AppDataSource.getRepository(
        MentorshipRequest
      ).findOne({
        where: {
          mentorId: data.mentorId,
          menteeId: data.menteeId,
          status: MENTORSHIP_REQUEST_STATUS.ACCEPTED,
        },
      });

      if (!mentorshipRequest) {
        throw new AppError(
          'You can only book sessions with mentors who have accepted your mentorship request',
          StatusCodes.FORBIDDEN
        );
      }

      // Use a transaction to prevent race conditions
      const savedSession = await AppDataSource.transaction(
        async (transactionalEntityManager) => {
          const sessionRepository =
            transactionalEntityManager.getRepository(Session);

          // CRITICAL: Ensure the scheduled time is in the future
          const now = new Date();
          if (data.scheduledAt <= now) {
            throw new AppError(
              'Cannot schedule a session in the past',
              StatusCodes.BAD_REQUEST
            );
          }

          // Check if mentor is available at the requested time with duration overlap checking
          const duration = data.duration || SESSION_DURATION.ONE_HOUR;
          const isAvailable = await this.isMentorAvailable(
            data.mentorId,
            data.scheduledAt,
            duration
          );
          if (!isAvailable) {
            throw new AppError(
              'Mentor is not available at the requested time',
              StatusCodes.CONFLICT
            );
          }

          // Double-check for overlapping sessions within the transaction (prevents race condition)
          const requestedEndTime = addMinutes(data.scheduledAt, duration);
          const activeStatuses = [
            SESSION_STATUS.SCHEDULED,
            SESSION_STATUS.CONFIRMED,
            SESSION_STATUS.IN_PROGRESS,
          ];

          // Check for mentor conflicts
          const overlappingSessions = await sessionRepository
            .createQueryBuilder('session')
            .where('session.mentorId = :mentorId', { mentorId: data.mentorId })
            .andWhere('session.status IN (:...statuses)', {
              statuses: activeStatuses,
            })
            .andWhere(
              '(session.scheduledAt < :requestedEnd AND DATE_ADD(session.scheduledAt, INTERVAL session.duration MINUTE) > :requestedStart)',
              {
                requestedStart: data.scheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (overlappingSessions.length > 0) {
            throw new AppError(
              'Mentor is not available at the requested time (time slot conflict)',
              StatusCodes.CONFLICT
            );
          }

          // Check for mentee conflicts (prevent double-booking)
          const menteeOverlappingSessions = await sessionRepository
            .createQueryBuilder('session')
            .where('session.menteeId = :menteeId', { menteeId: data.menteeId })
            .andWhere('session.status IN (:...statuses)', {
              statuses: activeStatuses,
            })
            .andWhere(
              '(session.scheduledAt < :requestedEnd AND DATE_ADD(session.scheduledAt, INTERVAL session.duration MINUTE) > :requestedStart)',
              {
                requestedStart: data.scheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (menteeOverlappingSessions.length > 0) {
            throw new AppError(
              'You already have a session scheduled at this time',
              StatusCodes.CONFLICT
            );
          }

          // Check for mentor group session conflicts
          const groupSessionRepository = transactionalEntityManager.getRepository(GroupSession);
          const overlappingGroupSessions = await groupSessionRepository
            .createQueryBuilder('gs')
            .where('gs.mentorId = :mentorId', { mentorId: data.mentorId })
            .andWhere('gs.status IN (:...statuses)', {
              statuses: ['invites_sent', 'confirmed', 'in_progress'],
            })
            .andWhere(
              '(gs.scheduledAt < :requestedEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :requestedStart)',
              {
                requestedStart: data.scheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (overlappingGroupSessions.length > 0) {
            throw new AppError(
              'Mentor has a conflicting group session at this time',
              StatusCodes.CONFLICT
            );
          }

          // Check for mentee group session conflicts
          const menteeGroupSessions = await groupSessionRepository
            .createQueryBuilder('gs')
            .leftJoin('gs.participants', 'participant')
            .where('participant.menteeId = :menteeId', { menteeId: data.menteeId })
            .andWhere('participant.invitationStatus = :status', { status: 'accepted' })
            .andWhere('gs.status IN (:...statuses)', {
              statuses: ['invites_sent', 'confirmed', 'in_progress'],
            })
            .andWhere(
              '(gs.scheduledAt < :requestedEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :requestedStart)',
              {
                requestedStart: data.scheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (menteeGroupSessions.length > 0) {
            throw new AppError(
              'You already have a group session scheduled at this time',
              StatusCodes.CONFLICT
            );
          }

          // Create session within transaction
          const session = sessionRepository.create({
            mentorId: data.mentorId,
            menteeId: data.menteeId,
            scheduledAt: data.scheduledAt,
            timezone: mentee.timezone || 'UTC', // Use mentee's timezone
            type: data.type || SESSION_TYPE.ONE_ON_ONE,
            duration: duration,
            title: data.title,
            description: data.description,
            meetingLink: data.meetingLink,
            meetingId: data.meetingId,
            meetingPassword: data.meetingPassword,
            location: data.location,
            isRecurring: data.isRecurring || false,
            recurringPattern: data.recurringPattern,
            status: SESSION_STATUS.SCHEDULED,
          });

          return await sessionRepository.save(session);
        }
      );

      logger.info('Session created successfully', {
        sessionId: savedSession.id,
        mentorId: data.mentorId,
        menteeId: data.menteeId,
        scheduledAt: data.scheduledAt,
      });

      // Send email notification to mentor
      try {
        const emailService = getEmailService();
        const scheduledTimeFormatted = formatSessionTime(data.scheduledAt);
        const sessionType = formatSessionType(savedSession.type);
        await emailService.sendSessionRequestEmail(
          mentor.email,
          `${mentor.firstName} ${mentor.lastName}`,
          `${mentee.firstName} ${mentee.lastName}`,
          scheduledTimeFormatted,
          savedSession.duration,
          sessionType,
          data.location
        );
      } catch (emailError: any) {
        logger.error('Failed to send session request email', emailError);
      }

      // Create in-app notification for mentor
      try {
        const notificationService = getAppNotificationService();
        const scheduledTimeFormatted = formatSessionTime(data.scheduledAt);
        await notificationService.createNotification({
          userId: mentor.id,
          type: AppNotificationType.SESSION_REQUEST,
          title: '📅 New Session Request',
          message: `${mentee.firstName} ${mentee.lastName} requested a session on ${scheduledTimeFormatted}`,
          data: {
            sessionId: savedSession.id,
            menteeId: mentee.id,
            scheduledAt: data.scheduledAt.toISOString(),
          },
        });
      } catch (notifError: any) {
        logger.error('Failed to create in-app notification', notifError);
      }

      // Send push notification to mentor
      try {
        if (mentor.pushToken) {
          const scheduledTimeFormatted = formatSessionTime(data.scheduledAt);
          await pushNotificationService.sendSessionRequestNotification(
            mentor.pushToken,
            mentor.id,
            `${mentee.firstName} ${mentee.lastName}`,
            scheduledTimeFormatted
          );
        }
      } catch (pushError: any) {
        logger.error('Failed to send session request push notification', pushError);
      }

      return savedSession;
    } catch (error: any) {
      logger.error('Error creating session', error);
      throw error;
    }
  }

  /**
   * Update session details
   */
  async updateSession(
    sessionId: string,
    data: UpdateSessionDTO,
    userId: string
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Check if user has permission to update this session
      if (session.mentorId !== userId && session.menteeId !== userId) {
        throw new AppError(
          'You do not have permission to update this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Update session fields
      Object.assign(session, data);
      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session updated successfully', {
        sessionId,
        userId,
        updatedFields: Object.keys(data),
      });

      return updatedSession;
    } catch (error: any) {
      logger.error('Error updating session', error);
      throw error;
    }
  }

  /**
   * Get sessions for a user (mentor or mentee)
   */
  async getUserSessions(
    userId: string,
    userRole: 'mentor' | 'mentee',
    options: {
      status?: SESSION_STATUS;
      limit?: number;
      offset?: number;
      upcoming?: boolean;
      past?: boolean;
      menteeId?: string;
      mentorId?: string;
    } = {}
  ): Promise<{ sessions: Session[]; total: number }> {
    try {
      const queryBuilder = this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentor', 'mentor')
        .leftJoinAndSelect('session.mentee', 'mentee');

      if (userRole === 'mentor') {
        queryBuilder.where('session.mentorId = :userId', { userId });
        if (options.menteeId) {
          queryBuilder.andWhere('session.menteeId = :menteeId', {
            menteeId: options.menteeId,
          });
        }
      } else {
        queryBuilder.where('session.menteeId = :userId', { userId });
        if (options.mentorId) {
          queryBuilder.andWhere('session.mentorId = :mentorId', {
            mentorId: options.mentorId,
          });
        }
      }

      if (options.status) {
        queryBuilder.andWhere('session.status = :status', {
          status: options.status,
        });
      }

      if (options.upcoming) {
        // A session is upcoming if it hasn't finished its duration + a 30-minute grace buffer
        queryBuilder.andWhere(
          'DATE_ADD(session.scheduledAt, INTERVAL (session.duration + 30) MINUTE) > :now',
          { now: new Date() }
        );
        // Exclude inactive and terminal statuses from upcoming
        queryBuilder.andWhere('session.status NOT IN (:...inactiveStatuses)', {
          inactiveStatuses: [
            SESSION_STATUS.CANCELLED,
            SESSION_STATUS.COMPLETED,
            SESSION_STATUS.NO_SHOW,
            SESSION_STATUS.RESCHEDULED,
          ],
        });
      }

      if (options.past) {
        queryBuilder.andWhere('session.scheduledAt < :now', {
          now: new Date(),
        });
        // Exclude cancelled sessions from past (but include completed and other statuses)
        queryBuilder.andWhere('session.status != :cancelledStatus', {
          cancelledStatus: SESSION_STATUS.CANCELLED,
        });
      }

      // Order by scheduledAt - DESC for past (newest first), ASC for upcoming (oldest first)
      const orderDirection = options.past ? 'DESC' : 'ASC';
      queryBuilder
        .orderBy('session.scheduledAt', orderDirection)
        .skip(options.offset || 0)
        .take(options.limit || 20);

      const [sessions, total] = await queryBuilder.getManyAndCount();

      // If user is a mentor, enrich mentee data with profile images
      if (userRole === 'mentor' && sessions.length > 0) {
        const menteeIds = sessions
          .map((s) => s.menteeId)
          .filter((id): id is string => id !== null && id !== undefined);

        if (menteeIds.length > 0) {
          const menteeProfiles = await AppDataSource.getRepository(
            MenteeProfile
          ).find({
            where: { userId: In(menteeIds) },
            select: ['userId', 'profileImage'],
          });

          const profileImageMap = new Map(
            menteeProfiles.map((p) => [p.userId, p.profileImage])
          );

          // Attach profile images to mentee objects
          for (const session of sessions) {
            if (session.mentee && session.menteeId) {
              const profileImage = profileImageMap.get(session.menteeId);
              if (profileImage) {
                (session.mentee as any).profileImage = profileImage;
              }
            }
          }
        }
      }

      // If user is a mentee, enrich mentor data with profile images
      if (userRole === 'mentee' && sessions.length > 0) {
        const mentorIds = sessions
          .map((s) => s.mentorId)
          .filter((id): id is string => id !== null && id !== undefined);

        if (mentorIds.length > 0) {
          const mentorProfiles = await AppDataSource.getRepository(
            MentorProfile
          ).find({
            where: { userId: In(mentorIds) },
            select: ['userId', 'profileImage'],
          });

          const profileImageMap = new Map(
            mentorProfiles.map((p) => [p.userId, p.profileImage])
          );

          // Attach profile images to mentor objects
          for (const session of sessions) {
            if (session.mentor && session.mentorId) {
              const profileImage = profileImageMap.get(session.mentorId);
              if (profileImage) {
                (session.mentor as any).profileImage = profileImage;
              }
            }
          }
        }
      }

      return { sessions, total };
    } catch (error: any) {
      // If error is due to missing column, try to run migration or use fallback
      if (
        error.message &&
        error.message.includes('Unknown column') &&
        error.message.includes('previousScheduledAt')
      ) {
        logger.warn(
          'Missing previousScheduledAt column detected. Please run migration 1764500000000-AddPreviousScheduledAtToSession'
        );
        // Try to use find() as fallback (but this won't work with all filters)
        // For now, just log and rethrow - the migration should be run
        logger.error(
          'Error getting user sessions - missing database column. Please run migrations.',
          error
        );
      }
      logger.error('Error getting user sessions', error);
      throw error;
    }
  }

  /**
   * Get a specific session by ID
   */
  async getSessionById(sessionId: string, userId: string): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Check if user has permission to view this session
      if (session.mentorId !== userId && session.menteeId !== userId) {
        throw new AppError(
          'You do not have permission to view this session',
          StatusCodes.FORBIDDEN
        );
      }

      return session;
    } catch (error: any) {
      logger.error('Error getting session by ID', error);
      throw error;
    }
  }

  /**
   * Cancel a session
   */
  async cancelSession(
    sessionId: string,
    userId: string,
    reason?: string
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Check if user has permission to cancel this session
      if (session.mentorId !== userId && session.menteeId !== userId) {
        throw new AppError(
          'You do not have permission to cancel this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if session can be cancelled
      if (session.status === SESSION_STATUS.CANCELLED) {
        throw new AppError(
          'Session is already cancelled',
          StatusCodes.BAD_REQUEST
        );
      }

      if (session.status === SESSION_STATUS.COMPLETED) {
        throw new AppError(
          'Cannot cancel a completed session',
          StatusCodes.BAD_REQUEST
        );
      }

      session.status = SESSION_STATUS.CANCELLED;
      session.cancelledAt = new Date();
      session.cancellationReason = reason;

      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session cancelled successfully', {
        sessionId,
        userId,
        reason,
      });

      return updatedSession;
    } catch (error: any) {
      logger.error('Error cancelling session', error);
      throw error;
    }
  }

  /**
   * Check if two time ranges overlap
   */
  private doTimeRangesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Check if mentor is available at a specific time with duration
   */
  async isMentorAvailable(
    mentorId: string,
    requestedTime: Date,
    requestedDuration?: SESSION_DURATION
  ): Promise<boolean> {
    try {
      // Get all availability records to determine mentor's timezone
      // We'll use the first availability's timezone, or default to UTC
      const allAvailabilities = await this.availabilityRepository.find({
        where: {
          mentorId,
          status: AVAILABILITY_STATUS.AVAILABLE,
        },
      });

      // Get mentor's timezone from availability records (use first one found, or default to UTC)
      const mentorTimezone =
        allAvailabilities.length > 0 && allAvailabilities[0].timezone
          ? allAvailabilities[0].timezone
          : 'UTC';

      // Convert requested UTC time to mentor's timezone
      const requestedTimeInMentorTz = toZonedTime(
        requestedTime,
        mentorTimezone
      );

      // Extract day of week and time in mentor's timezone
      const dayOfWeek = requestedTimeInMentorTz.getDay() as DAY_OF_WEEK;
      const timeString = formatTz(requestedTimeInMentorTz, 'HH:mm:ss', {
        timeZone: mentorTimezone,
      });

      // Get date string in mentor's timezone (YYYY-MM-DD)
      const requestedDateString = formatTz(
        requestedTimeInMentorTz,
        'yyyy-MM-dd',
        { timeZone: mentorTimezone }
      );

      logger.info('Checking mentor availability', {
        mentorId,
        requestedTime: requestedTime.toISOString(),
        mentorTimezone,
        requestedTimeInMentorTz: requestedTimeInMentorTz.toISOString(),
        dayOfWeek,
        timeString,
        requestedDateString,
      });

      logger.info('Found availability records', {
        mentorId,
        count: allAvailabilities.length,
        availabilities: allAvailabilities.map((a) => ({
          id: a.id,
          dayOfWeek: a.dayOfWeek,
          isRecurring: a.isRecurring,
          specificDate: a.specificDate,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      });

      let availability = await this.availabilityRepository
        .createQueryBuilder('availability')
        .where('availability.mentorId = :mentorId', { mentorId })
        .andWhere('availability.status = :status', {
          status: AVAILABILITY_STATUS.AVAILABLE,
        })
        .andWhere('availability.isRecurring = :isRecurring', {
          isRecurring: false,
        })
        .andWhere('DATE(availability.specificDate) = :requestedDate', {
          requestedDate: requestedDateString,
        })
        .getOne();

      logger.info('Specific date availability check', {
        mentorId,
        requestedDateString,
        found: !!availability,
        availabilityId: availability?.id,
      });

      // If no specific date availability, check for recurring availability
      if (!availability) {
        availability = await this.availabilityRepository.findOne({
          where: {
            mentorId,
            dayOfWeek,
            status: AVAILABILITY_STATUS.AVAILABLE,
            isRecurring: true,
          },
        });

        logger.info('Recurring availability check', {
          mentorId,
          dayOfWeek,
          found: !!availability,
          availabilityId: availability?.id,
        });
      }

      if (!availability) {
        logger.warn('No availability found for mentor', {
          mentorId,
          requestedTime: requestedTime.toISOString(),
          dayOfWeek,
          requestedDateString,
        });
        return false;
      }

      // Calculate requested session end time in mentor's timezone
      const duration = requestedDuration || SESSION_DURATION.ONE_HOUR;
      const requestedEndTime = addMinutes(requestedTime, duration);
      const requestedEndTimeInMentorTz = toZonedTime(
        requestedEndTime,
        mentorTimezone
      );
      const requestedEndTimeString = formatTz(
        requestedEndTimeInMentorTz,
        'HH:mm:ss',
        { timeZone: mentorTimezone }
      );

      logger.info('Found availability, checking time range', {
        mentorId,
        availabilityId: availability.id,
        availabilityStartTime: availability.startTime,
        availabilityEndTime: availability.endTime,
        requestedStartTimeString: timeString,
        requestedEndTimeString,
        duration,
      });

      // Check if requested session START time is within available hours
      if (timeString < availability.startTime) {
        logger.warn('Requested start time before available hours', {
          mentorId,
          requestedTimeString: timeString,
          availabilityStartTime: availability.startTime,
        });
        return false;
      }

      // Check if requested session END time is within available hours
      if (requestedEndTimeString > availability.endTime) {
        logger.warn('Requested end time after available hours', {
          mentorId,
          requestedEndTimeString,
          availabilityEndTime: availability.endTime,
        });
        return false;
      }

      // Check for breaks - check if session overlaps with any break period
      if (availability.breaks) {
        for (const breakPeriod of availability.breaks) {
          // Check if session start time is within break
          if (
            timeString >= breakPeriod.startTime &&
            timeString <= breakPeriod.endTime
          ) {
            logger.warn('Session start time conflicts with break', {
              mentorId,
              requestedTimeString: timeString,
              breakStart: breakPeriod.startTime,
              breakEnd: breakPeriod.endTime,
            });
            return false;
          }
          // Check if session end time is within break
          if (
            requestedEndTimeString >= breakPeriod.startTime &&
            requestedEndTimeString <= breakPeriod.endTime
          ) {
            logger.warn('Session end time conflicts with break', {
              mentorId,
              requestedEndTimeString,
              breakStart: breakPeriod.startTime,
              breakEnd: breakPeriod.endTime,
            });
            return false;
          }
          // Check if session spans across a break
          if (
            timeString < breakPeriod.startTime &&
            requestedEndTimeString > breakPeriod.endTime
          ) {
            logger.warn('Session spans across break period', {
              mentorId,
              requestedTimeString: timeString,
              requestedEndTimeString,
              breakStart: breakPeriod.startTime,
              breakEnd: breakPeriod.endTime,
            });
            return false;
          }
        }
      }

      // Check for overlapping sessions (scheduled or confirmed) using time ranges
      const activeStatuses = [
        SESSION_STATUS.SCHEDULED,
        SESSION_STATUS.CONFIRMED,
        SESSION_STATUS.IN_PROGRESS,
      ];

      const existingSessions = await this.sessionRepository.find({
        where: {
          mentorId,
          status: In(activeStatuses),
        },
      });

      // Check if any existing session overlaps with requested time range
      for (const existingSession of existingSessions) {
        const existingStart = new Date(existingSession.scheduledAt);
        const existingEnd = addMinutes(existingStart, existingSession.duration);

        if (
          this.doTimeRangesOverlap(
            requestedTime,
            requestedEndTime,
            existingStart,
            existingEnd
          )
        ) {
          return false;
        }
      }

      // Check for overlapping group sessions
      const groupSessionRepository = AppDataSource.getRepository(GroupSession);
      const startOfDay = new Date(requestedTime);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedTime);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const existingGroupSessions = await groupSessionRepository
        .createQueryBuilder('gs')
        .where('gs.mentorId = :mentorId', { mentorId })
        .andWhere('gs.status IN (:...statuses)', {
          statuses: ['invites_sent', 'confirmed', 'in_progress'],
        })
        .andWhere('gs.scheduledAt BETWEEN :startOfDay AND :endOfDay', {
          startOfDay,
          endOfDay,
        })
        .getMany();

      // Check if any existing group session overlaps with requested time range
      for (const existingGroupSession of existingGroupSessions) {
        const existingStart = new Date(existingGroupSession.scheduledAt);
        const existingEnd = addMinutes(existingStart, existingGroupSession.duration);

        if (
          this.doTimeRangesOverlap(
            requestedTime,
            requestedEndTime,
            existingStart,
            existingEnd
          )
        ) {
          logger.warn('Requested time conflicts with group session', {
            mentorId,
            requestedTime: requestedTime.toISOString(),
            groupSessionId: existingGroupSession.id,
            groupSessionStart: existingStart.toISOString(),
            groupSessionEnd: existingEnd.toISOString(),
          });
          return false;
        }
      }

      return true;
    } catch (error: any) {
      logger.error('Error checking mentor availability', error);
      throw error;
    }
  }

  /**
   * Create or update mentor availability
   * If availability exists for the same day, it updates it; otherwise creates new
   */
  async createAvailability(
    data: CreateAvailabilityDTO
  ): Promise<MentorAvailability> {
    try {
      const mentor = await this.userRepository.findOne({
        where: { id: data.mentorId, role: USER_ROLE.MENTOR as any },
      });

      if (!mentor) {
        throw new AppError('Mentor not found', StatusCodes.NOT_FOUND);
      }

      // Check if availability already exists for this day
      const existingAvailability = await this.availabilityRepository.findOne({
        where: {
          mentorId: data.mentorId,
          dayOfWeek: data.dayOfWeek,
          isRecurring: !data.specificDate,
          ...(data.specificDate && { specificDate: data.specificDate }),
        },
      });

      if (existingAvailability) {
        // Update existing availability
        existingAvailability.startTime = data.startTime;
        existingAvailability.endTime = data.endTime;
        existingAvailability.slotDuration = data.slotDuration || 30;
        existingAvailability.timezone = data.timezone;
        existingAvailability.breaks = data.breaks;
        existingAvailability.notes = data.notes;
        existingAvailability.status = AVAILABILITY_STATUS.AVAILABLE;

        const updatedAvailability = await this.availabilityRepository.save(
          existingAvailability
        );

        logger.info('Mentor availability updated successfully', {
          availabilityId: updatedAvailability.id,
          mentorId: data.mentorId,
          dayOfWeek: data.dayOfWeek,
        });

        return updatedAvailability;
      } else {
        // Create new availability
        const availability = this.availabilityRepository.create({
          mentorId: data.mentorId,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          endTime: data.endTime,
          slotDuration: data.slotDuration || 30,
          timezone: data.timezone,
          specificDate: data.specificDate,
          breaks: data.breaks,
          notes: data.notes,
          isRecurring: !data.specificDate,
          status: AVAILABILITY_STATUS.AVAILABLE,
        });

        const savedAvailability = await this.availabilityRepository.save(
          availability
        );

        logger.info('Mentor availability created successfully', {
          availabilityId: savedAvailability.id,
          mentorId: data.mentorId,
          dayOfWeek: data.dayOfWeek,
        });

        return savedAvailability;
      }
    } catch (error: any) {
      logger.error('Error creating/updating mentor availability', error);
      throw error;
    }
  }

  /**
   * Get mentor availability
   */
  async getMentorAvailability(mentorId: string): Promise<MentorAvailability[]> {
    try {
      const availability = await this.availabilityRepository.find({
        where: { mentorId },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });

      return availability;
    } catch (error: any) {
      logger.error('Error getting mentor availability', error);
      throw error;
    }
  }

  /**
   * Delete mentor availability
   */
  async deleteAvailability(
    availabilityId: string,
    mentorId: string
  ): Promise<void> {
    try {
      const availability = await this.availabilityRepository.findOne({
        where: { id: availabilityId, mentorId },
      });

      if (!availability) {
        throw new AppError(
          'Availability not found or you do not have permission to delete it',
          StatusCodes.NOT_FOUND
        );
      }

      await this.availabilityRepository.remove(availability);

      logger.info('Mentor availability deleted successfully', {
        availabilityId,
        mentorId,
      });
    } catch (error: any) {
      logger.error('Error deleting mentor availability', error);
      throw error;
    }
  }

  /**
   * Get available time slots for a mentor on a specific date
   */
  async getAvailableSlots(
    mentorId: string,
    date: Date
  ): Promise<Array<{ time: string; available: boolean }>> {
    try {
      // Use getUTCDay() because the date string "YYYY-MM-DD" is parsed as UTC midnight
      // getDay() would return the local day, which can be off by one based on server timezone
      const dayOfWeek = date.getUTCDay() as DAY_OF_WEEK;
      const dateString = date.toISOString().split('T')[0];

      // 1. Check for specific date availability (overrides recurring)
      let availability = await this.availabilityRepository
        .createQueryBuilder('availability')
        .where('availability.mentorId = :mentorId', { mentorId })
        .andWhere('availability.status = :status', {
          status: AVAILABILITY_STATUS.AVAILABLE,
        })
        .andWhere('availability.isRecurring = :isRecurring', {
          isRecurring: false,
        })
        .andWhere('DATE(availability.specificDate) = :date', {
          date: dateString,
        })
        .getOne();

      // 2. If no specific date, check for recurring availability
      if (!availability) {
        availability = await this.availabilityRepository.findOne({
          where: {
            mentorId,
            dayOfWeek,
            status: AVAILABILITY_STATUS.AVAILABLE,
            isRecurring: true,
          },
        });
      }

      if (!availability) {
        return [];
      }

      const slots: Array<{ time: string; available: boolean }> = [];
      const startTime = new Date(`1970-01-01T${availability.startTime}`);
      const endTime = new Date(`1970-01-01T${availability.endTime}`);
      const slotDuration = availability.slotDuration;
      const activeStatuses = [
        SESSION_STATUS.SCHEDULED,
        SESSION_STATUS.CONFIRMED,
        SESSION_STATUS.IN_PROGRESS,
      ];

      // Fetch overlapping sessions for this specific date once (outside the loop)
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const overlappingSessions = await this.sessionRepository.find({
        where: {
          mentorId,
          status: In(activeStatuses),
          scheduledAt: Between(startOfDay, endOfDay),
        },
      });

      // Fetch overlapping group sessions for this specific date
      const groupSessionRepository = AppDataSource.getRepository(GroupSession);
      const overlappingGroupSessions = await groupSessionRepository
        .createQueryBuilder('gs')
        .where('gs.mentorId = :mentorId', { mentorId })
        .andWhere('gs.status IN (:...statuses)', {
          statuses: ['invites_sent', 'confirmed', 'in_progress'],
        })
        .andWhere('gs.scheduledAt BETWEEN :startOfDay AND :endOfDay', {
          startOfDay,
          endOfDay,
        })
        .getMany();

      let currentTime = new Date(startTime);
      while (currentTime < endTime) {
        const timeString = currentTime.toTimeString().slice(0, 5); // HH:MM format

        // Check if this time slot is in a break
        let isInBreak = false;
        if (availability.breaks) {
          for (const breakPeriod of availability.breaks) {
            if (
              timeString >= breakPeriod.startTime.slice(0, 5) &&
              timeString < breakPeriod.endTime.slice(0, 5)
            ) {
              isInBreak = true;
              break;
            }
          }
        }

        // Check if there's already a session overlapping with this time slot
        const sessionDateTime = new Date(date);
        sessionDateTime.setUTCHours(
          currentTime.getHours(),
          currentTime.getMinutes(),
          0,
          0
        );
        const slotEndTime = addMinutes(sessionDateTime, slotDuration);
        let hasOverlap = false;
        for (const existingSession of overlappingSessions) {
          const existingStart = new Date(existingSession.scheduledAt);
          const existingEnd = addMinutes(
            existingStart,
            existingSession.duration
          );

          if (
            this.doTimeRangesOverlap(
              sessionDateTime,
              slotEndTime,
              existingStart,
              existingEnd
            )
          ) {
            hasOverlap = true;
            break;
          }
        }

        // Check for group session overlaps
        if (!hasOverlap) {
          for (const existingGroupSession of overlappingGroupSessions) {
            const existingStart = new Date(existingGroupSession.scheduledAt);
            const existingEnd = addMinutes(
              existingStart,
              existingGroupSession.duration
            );

            if (
              this.doTimeRangesOverlap(
                sessionDateTime,
                slotEndTime,
                existingStart,
                existingEnd
              )
            ) {
              hasOverlap = true;
              break;
            }
          }
        }

        // Check if the slot is in the past
        const isPast = sessionDateTime <= new Date();

        slots.push({
          time: timeString,
          available: !isInBreak && !hasOverlap && !isPast,
        });

        currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
      }

      return slots;
    } catch (error: any) {
      logger.error('Error getting available slots', error);
      throw error;
    }
  }

  /**
   * Accept a session request (mentor only)
   */
  async acceptSession(sessionId: string, mentorId: string): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Verify the user is the mentor for this session
      if (session.mentorId !== mentorId) {
        throw new AppError(
          'Only the mentor can accept this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Check current status
      if (session.status !== SESSION_STATUS.SCHEDULED) {
        throw new AppError(
          `Cannot accept session with status: ${session.status}`,
          StatusCodes.BAD_REQUEST
        );
      }

      // Update status to confirmed
      session.status = SESSION_STATUS.CONFIRMED;
      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session accepted by mentor', {
        sessionId,
        mentorId,
        menteeId: session.menteeId,
      });

      // Send email notification to mentee
      try {
        const emailService = getEmailService();
        const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
        const sessionType = formatSessionType(session.type);
        await emailService.sendSessionAcceptedEmail(
          session.mentee.email,
          `${session.mentee.firstName} ${session.mentee.lastName}`,
          `${session.mentor.firstName} ${session.mentor.lastName}`,
          scheduledTimeFormatted,
          session.duration,
          sessionType,
          session.location
        );
      } catch (emailError: any) {
        logger.error('Failed to send session accepted email', emailError);
      }

      // Create in-app notification for mentee
      try {
        const notificationService = getAppNotificationService();
        const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
        await notificationService.createNotification({
          userId: session.menteeId,
          type: AppNotificationType.SESSION_CONFIRMED,
          title: '✅ Session Confirmed',
          message: `${session.mentor.firstName} ${session.mentor.lastName} confirmed your session on ${scheduledTimeFormatted}`,
          data: {
            sessionId: session.id,
            mentorId: session.mentorId,
            scheduledAt: session.scheduledAt.toISOString(),
          },
        });
      } catch (notifError: any) {
        logger.error('Failed to create in-app notification', notifError);
      }

      // Send push notification to mentee
      try {
        if (session.mentee?.pushToken) {
          const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
          await pushNotificationService.sendSessionStatusNotification(
            session.mentee.pushToken,
            session.mentee.id,
            `${session.mentor.firstName} ${session.mentor.lastName}`,
            'accepted',
            scheduledTimeFormatted
          );
        }
      } catch (pushError: any) {
        logger.error('Failed to send session acceptance push notification', pushError);
      }

      return updatedSession;
    } catch (error: any) {
      logger.error('Error accepting session', error);
      throw error;
    }
  }

  /**
   * Decline a session request (mentor only)
   */
  async declineSession(
    sessionId: string,
    mentorId: string,
    reason?: string
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Verify the user is the mentor for this session
      if (session.mentorId !== mentorId) {
        throw new AppError(
          'Only the mentor can decline this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Check current status
      if (session.status !== SESSION_STATUS.SCHEDULED) {
        throw new AppError(
          `Cannot decline session with status: ${session.status}`,
          StatusCodes.BAD_REQUEST
        );
      }

      // Update status to cancelled
      session.status = SESSION_STATUS.CANCELLED;
      session.cancelledAt = new Date();
      session.cancellationReason = reason || 'Declined by mentor';

      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session declined by mentor', {
        sessionId,
        mentorId,
        menteeId: session.menteeId,
        reason,
      });

      // Send email notification to mentee
      try {
        const emailService = getEmailService();
        const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
        await emailService.sendSessionDeclinedEmail(
          session.mentee.email,
          `${session.mentee.firstName} ${session.mentee.lastName}`,
          `${session.mentor.firstName} ${session.mentor.lastName}`,
          scheduledTimeFormatted,
          reason
        );
      } catch (emailError: any) {
        logger.error('Failed to send session declined email', emailError);
      }

      // Create in-app notification for mentee
      try {
        const notificationService = getAppNotificationService();
        const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
        await notificationService.createNotification({
          userId: session.menteeId,
          type: AppNotificationType.SESSION_DECLINED,
          title: '❌ Session Declined',
          message: `${session.mentor.firstName} ${
            session.mentor.lastName
          } declined your session on ${scheduledTimeFormatted}${
            reason ? `: ${reason}` : ''
          }`,
          data: {
            sessionId: session.id,
            mentorId: session.mentorId,
            scheduledAt: session.scheduledAt.toISOString(),
            reason,
          },
        });
      } catch (notifError: any) {
        logger.error('Failed to create in-app notification', notifError);
      }

      // Send push notification to mentee
      try {
        if (session.mentee?.pushToken) {
          const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
          await pushNotificationService.sendSessionStatusNotification(
            session.mentee.pushToken,
            session.mentee.id,
            `${session.mentor.firstName} ${session.mentor.lastName}`,
            'declined',
            scheduledTimeFormatted
          );
        }
      } catch (pushError: any) {
        logger.error('Failed to send session decline push notification', pushError);
      }

      return updatedSession;
    } catch (error: any) {
      logger.error('Error declining session', error);
      throw error;
    }
  }

  async rescheduleSession(
    sessionId: string,
    newScheduledAt: string,
    userId: string,
    reason?: string,
    message?: string
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Only mentee can request reschedule
      if (session.menteeId !== userId) {
        throw new AppError(
          'Only the mentee can request to reschedule this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Cannot reschedule completed or cancelled sessions
      if (
        session.status === SESSION_STATUS.COMPLETED ||
        session.status === SESSION_STATUS.CANCELLED
      ) {
        throw new AppError(
          `Cannot reschedule a ${session.status} session`,
          StatusCodes.BAD_REQUEST
        );
      }

      const newTimeDate = new Date(newScheduledAt);

      // CRITICAL: Ensure the new time is in the future
      if (newTimeDate <= new Date()) {
        throw new AppError(
          'Cannot reschedule a session to a past time',
          StatusCodes.BAD_REQUEST
        );
      }

      // Ensure the new time is different from the current scheduled time
      if (newTimeDate.getTime() === session.scheduledAt.getTime()) {
        throw new AppError(
          'New scheduled time must be different from the current scheduled time',
          StatusCodes.BAD_REQUEST
        );
      }

      // Validate mentor availability at the new requested time
      const newScheduledAtDate = new Date(newScheduledAt);
      const isAvailable = await this.isMentorAvailable(
        session.mentorId,
        newScheduledAtDate,
        session.duration
      );

      if (!isAvailable) {
        throw new AppError(
          'Mentor is not available at the requested reschedule time',
          StatusCodes.CONFLICT
        );
      }

      // Check for overlapping sessions at the new time (excluding current session)
      const requestedEndTime = addMinutes(newScheduledAtDate, session.duration);
      const activeStatuses = [
        SESSION_STATUS.SCHEDULED,
        SESSION_STATUS.CONFIRMED,
        SESSION_STATUS.IN_PROGRESS,
      ];

      const overlappingSessions = await this.sessionRepository.find({
        where: {
          mentorId: session.mentorId,
          status: In(activeStatuses),
        },
      });

      // Check if any session (other than current) overlaps with requested time
      for (const existingSession of overlappingSessions) {
        // Skip the current session being rescheduled
        if (existingSession.id === session.id) {
          continue;
        }

        const existingStart = new Date(existingSession.scheduledAt);
        const existingEnd = addMinutes(existingStart, existingSession.duration);

        if (
          this.doTimeRangesOverlap(
            newScheduledAtDate,
            requestedEndTime,
            existingStart,
            existingEnd
          )
        ) {
          throw new AppError(
            'The requested reschedule time conflicts with another session',
            StatusCodes.CONFLICT
          );
        }
      }

      // Check for mentor group session conflicts
      const groupSessionRepository = AppDataSource.getRepository(GroupSession);
      const mentorGroupSessions = await groupSessionRepository
        .createQueryBuilder('gs')
        .where('gs.mentorId = :mentorId', { mentorId: session.mentorId })
        .andWhere('gs.status IN (:...statuses)', {
          statuses: ['invites_sent', 'confirmed', 'in_progress'],
        })
        .andWhere(
          '(gs.scheduledAt < :requestedEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :requestedStart)',
          {
            requestedStart: newScheduledAtDate,
            requestedEnd: requestedEndTime,
          }
        )
        .getMany();

      if (mentorGroupSessions.length > 0) {
        throw new AppError(
          'Mentor has a conflicting group session at the requested time',
          StatusCodes.CONFLICT
        );
      }

      // Check for mentee regular session conflicts
      const menteeRegularSessions = await this.sessionRepository
        .createQueryBuilder('session')
        .where('session.menteeId = :menteeId', { menteeId: session.menteeId })
        .andWhere('session.id != :sessionId', { sessionId: session.id })
        .andWhere('session.status IN (:...statuses)', {
          statuses: activeStatuses,
        })
        .andWhere(
          '(session.scheduledAt < :requestedEnd AND DATE_ADD(session.scheduledAt, INTERVAL session.duration MINUTE) > :requestedStart)',
          {
            requestedStart: newScheduledAtDate,
            requestedEnd: requestedEndTime,
          }
        )
        .getMany();

      if (menteeRegularSessions.length > 0) {
        throw new AppError(
          'You already have a session scheduled at the requested time',
          StatusCodes.CONFLICT
        );
      }

      // Check for mentee group session conflicts
      const menteeGroupSessions = await groupSessionRepository
        .createQueryBuilder('gs')
        .leftJoin('gs.participants', 'participant')
        .where('participant.menteeId = :menteeId', { menteeId: session.menteeId })
        .andWhere('participant.invitationStatus = :status', { status: 'accepted' })
        .andWhere('gs.status IN (:...statuses)', {
          statuses: ['invites_sent', 'confirmed', 'in_progress'],
        })
        .andWhere(
          '(gs.scheduledAt < :requestedEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :requestedStart)',
          {
            requestedStart: newScheduledAtDate,
            requestedEnd: requestedEndTime,
          }
        )
        .getMany();

      if (menteeGroupSessions.length > 0) {
        throw new AppError(
          'You already have a group session scheduled at the requested time',
          StatusCodes.CONFLICT
        );
      }

      // Store the reschedule request details
      session.previousScheduledAt = session.scheduledAt;
      session.rescheduleRequestedAt = new Date();
      session.requestedScheduledAt = newScheduledAtDate;
      session.rescheduleReason = reason;
      session.rescheduleMessage = message;

      const updatedSession = await this.sessionRepository.save(session);

      const currentScheduledTime = new Date(session.scheduledAt);
      const sessionType = formatSessionType(session.type);
      const currentTimeFormatted = formatSessionTime(currentScheduledTime);
      const newTimeFormatted = formatSessionTime(new Date(newScheduledAt));

      logger.info('Session reschedule requested', {
        sessionId,
        userId,
        currentScheduledAt: currentScheduledTime,
        newScheduledAt,
        reason,
      });

      // Send email notification to mentor
      try {
        const emailService = getEmailService();
        await emailService.sendSessionRescheduleRequestEmail(
          session.mentor.email,
          `${session.mentor.firstName} ${session.mentor.lastName}`,
          `${session.mentee.firstName} ${session.mentee.lastName}`,
          currentTimeFormatted,
          newTimeFormatted,
          session.duration,
          reason,
          message,
          sessionType
        );
      } catch (emailError: any) {
        logger.error(
          'Failed to send session reschedule request email',
          emailError
        );
      }

      // Create in-app notification for mentor
      try {
        const notificationService = getAppNotificationService();
        await notificationService.createNotification({
          userId: session.mentorId,
          type: AppNotificationType.RESCHEDULE_REQUEST,
          title: '🔄 Reschedule Request',
          message: `${session.mentee.firstName} ${session.mentee.lastName} requested to reschedule session from ${currentTimeFormatted} to ${newTimeFormatted}`,
          data: {
            sessionId: session.id,
            menteeId: session.menteeId,
            currentScheduledAt: currentScheduledTime.toISOString(),
            requestedScheduledAt: newScheduledAt,
            reason,
            message,
          },
        });
      } catch (notifError: any) {
        logger.error('Failed to create in-app notification', notifError);
      }

      return updatedSession;
    } catch (error: any) {
      logger.error('Error requesting session reschedule', error);
      throw error;
    }
  }

  async acceptReschedule(
    sessionId: string,
    mentorId: string
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Verify the user is the mentor for this session
      if (session.mentorId !== mentorId) {
        throw new AppError(
          'Only the mentor can accept this reschedule',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if there's a pending reschedule request
      if (!session.rescheduleRequestedAt || !session.requestedScheduledAt) {
        throw new AppError(
          'No pending reschedule request for this session',
          StatusCodes.BAD_REQUEST
        );
      }

      const previousTime = session.scheduledAt;
      const requestedNewTime = session.requestedScheduledAt;

      if (!requestedNewTime) {
        throw new AppError(
          'No requested reschedule time found',
          StatusCodes.BAD_REQUEST
        );
      }

      const previousTimeFormatted = formatSessionTime(previousTime);
      const newTimeFormatted = formatSessionTime(requestedNewTime);

      // Use a transaction to prevent race conditions when accepting reschedule
      const updatedSession = await AppDataSource.transaction(
        async (transactionalEntityManager) => {
          const sessionRepository =
            transactionalEntityManager.getRepository(Session);

          // Re-fetch session within transaction to get latest state
          const currentSession = await sessionRepository.findOne({
            where: { id: sessionId },
            relations: ['mentor', 'mentee'],
          });

          if (!currentSession) {
            throw new AppError('Session not found', StatusCodes.NOT_FOUND);
          }

          // Verify reschedule request still exists
          if (
            !currentSession.rescheduleRequestedAt ||
            !currentSession.requestedScheduledAt
          ) {
            throw new AppError(
              'No pending reschedule request for this session',
              StatusCodes.BAD_REQUEST
            );
          }

          // CRITICAL: Ensure the requested time is still in the future
          if (currentSession.requestedScheduledAt <= new Date()) {
            throw new AppError(
              'Cannot accept a reschedule for a time that has already passed',
              StatusCodes.BAD_REQUEST
            );
          }

          // Validate mentor availability at the new time (may have changed since request)
          const isAvailable = await this.isMentorAvailable(
            currentSession.mentorId,
            currentSession.requestedScheduledAt,
            currentSession.duration
          );

          if (!isAvailable) {
            throw new AppError(
              'Mentor is no longer available at the requested reschedule time',
              StatusCodes.CONFLICT
            );
          }

          // Double-check for overlapping sessions within transaction (excluding current session)
          const requestedEndTime = addMinutes(
            currentSession.requestedScheduledAt,
            currentSession.duration
          );
          const activeStatuses = [
            SESSION_STATUS.SCHEDULED,
            SESSION_STATUS.CONFIRMED,
            SESSION_STATUS.IN_PROGRESS,
          ];

          const overlappingSessions = await sessionRepository
            .createQueryBuilder('session')
            .where('session.mentorId = :mentorId', {
              mentorId: currentSession.mentorId,
            })
            .andWhere('session.id != :sessionId', {
              sessionId: currentSession.id,
            })
            .andWhere('session.status IN (:...statuses)', {
              statuses: activeStatuses,
            })
            .andWhere(
              '(session.scheduledAt < :requestedEnd AND DATE_ADD(session.scheduledAt, INTERVAL session.duration MINUTE) > :requestedStart)',
              {
                requestedStart: currentSession.requestedScheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (overlappingSessions.length > 0) {
            throw new AppError(
              'The requested reschedule time conflicts with another session',
              StatusCodes.CONFLICT
            );
          }

          // Check for mentor group session conflicts
          const groupSessionRepository = transactionalEntityManager.getRepository(GroupSession);
          const mentorGroupSessions = await groupSessionRepository
            .createQueryBuilder('gs')
            .where('gs.mentorId = :mentorId', { mentorId: currentSession.mentorId })
            .andWhere('gs.status IN (:...statuses)', {
              statuses: ['invites_sent', 'confirmed', 'in_progress'],
            })
            .andWhere(
              '(gs.scheduledAt < :requestedEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :requestedStart)',
              {
                requestedStart: currentSession.requestedScheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (mentorGroupSessions.length > 0) {
            throw new AppError(
              'Mentor has a conflicting group session at the requested time',
              StatusCodes.CONFLICT
            );
          }

          // Check for mentee regular session conflicts
          const menteeRegularSessions = await sessionRepository
            .createQueryBuilder('session')
            .where('session.menteeId = :menteeId', { menteeId: currentSession.menteeId })
            .andWhere('session.id != :sessionId', { sessionId: currentSession.id })
            .andWhere('session.status IN (:...statuses)', {
              statuses: activeStatuses,
            })
            .andWhere(
              '(session.scheduledAt < :requestedEnd AND DATE_ADD(session.scheduledAt, INTERVAL session.duration MINUTE) > :requestedStart)',
              {
                requestedStart: currentSession.requestedScheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (menteeRegularSessions.length > 0) {
            throw new AppError(
              'Mentee has a conflicting session at the requested time',
              StatusCodes.CONFLICT
            );
          }

          // Check for mentee group session conflicts
          const menteeGroupSessions = await groupSessionRepository
            .createQueryBuilder('gs')
            .leftJoin('gs.participants', 'participant')
            .where('participant.menteeId = :menteeId', { menteeId: currentSession.menteeId })
            .andWhere('participant.invitationStatus = :status', { status: 'accepted' })
            .andWhere('gs.status IN (:...statuses)', {
              statuses: ['invites_sent', 'confirmed', 'in_progress'],
            })
            .andWhere(
              '(gs.scheduledAt < :requestedEnd AND DATE_ADD(gs.scheduledAt, INTERVAL gs.duration MINUTE) > :requestedStart)',
              {
                requestedStart: currentSession.requestedScheduledAt,
                requestedEnd: requestedEndTime,
              }
            )
            .getMany();

          if (menteeGroupSessions.length > 0) {
            throw new AppError(
              'Mentee has a conflicting group session at the requested time',
              StatusCodes.CONFLICT
            );
          }

          // Update session with new time within transaction
          currentSession.scheduledAt = currentSession.requestedScheduledAt;
          currentSession.status = SESSION_STATUS.CONFIRMED;
          currentSession.rescheduleRequestedAt = undefined;
          currentSession.requestedScheduledAt = undefined;
          currentSession.previousScheduledAt = undefined;
          currentSession.rescheduleReason = undefined;
          currentSession.rescheduleMessage = undefined;
          currentSession.reminders = {}; // Reset reminder flags for the new time

          return await sessionRepository.save(currentSession);
        }
      );

      // Re-fetch session with relations for notifications
      const finalSession = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!finalSession) {
        throw new AppError(
          'Session not found after update',
          StatusCodes.NOT_FOUND
        );
      }

      logger.info('Session reschedule accepted by mentor', {
        sessionId,
        mentorId,
        previousScheduledAt: previousTime,
        newScheduledAt: finalSession.scheduledAt,
      });

      // Send email notification to mentee
      try {
        const emailService = getEmailService();
        const sessionType = formatSessionType(finalSession.type);
        await emailService.sendSessionRescheduleAcceptedEmail(
          finalSession.mentee.email,
          `${finalSession.mentee.firstName} ${finalSession.mentee.lastName}`,
          `${finalSession.mentor.firstName} ${finalSession.mentor.lastName}`,
          previousTimeFormatted,
          newTimeFormatted,
          finalSession.duration,
          sessionType,
          finalSession.location
        );
      } catch (emailError: any) {
        logger.error(
          'Failed to send session reschedule accepted email',
          emailError
        );
      }

      // Create in-app notification for mentee
      try {
        const notificationService = getAppNotificationService();
        await notificationService.createNotification({
          userId: finalSession.menteeId,
          type: AppNotificationType.RESCHEDULE_ACCEPTED,
          title: '✅ Reschedule Accepted',
          message: `${finalSession.mentor.firstName} ${finalSession.mentor.lastName} accepted your reschedule request. New time: ${newTimeFormatted}`,
          data: {
            sessionId: finalSession.id,
            mentorId: finalSession.mentorId,
            previousScheduledAt: previousTime.toISOString(),
            newScheduledAt: finalSession.scheduledAt.toISOString(),
          },
        });
      } catch (notifError: any) {
        logger.error('Failed to create in-app notification for acceptance', notifError);
      }

      // Send push notification to mentee
      try {
        if (finalSession.mentee?.pushToken) {
          const scheduledTimeFormatted = formatSessionTime(finalSession.scheduledAt);
          await pushNotificationService.sendSessionStatusNotification(
            finalSession.mentee.pushToken,
            finalSession.mentee.id,
            `${finalSession.mentor.firstName} ${finalSession.mentor.lastName}`,
            'accepted',
            scheduledTimeFormatted
          );
        }
      } catch (pushError: any) {
        logger.error('Failed to send session acceptance push notification', pushError);
      }

      return finalSession;
    } catch (error: any) {
      logger.error('Error accepting session reschedule', error);
      throw error;
    }
  }

  async declineReschedule(
    sessionId: string,
    mentorId: string,
    reason?: string
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Verify the user is the mentor for this session
      if (session.mentorId !== mentorId) {
        throw new AppError(
          'Only the mentor can decline this reschedule',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if there's a pending reschedule request
      if (!session.rescheduleRequestedAt) {
        throw new AppError(
          'No pending reschedule request for this session',
          StatusCodes.BAD_REQUEST
        );
      }

      const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);

      // Clear reschedule request data (keep original time)
      session.previousScheduledAt = undefined;
      session.rescheduleRequestedAt = undefined;
      session.rescheduleReason = undefined;
      session.rescheduleMessage = undefined;

      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session reschedule declined by mentor', {
        sessionId,
        mentorId,
        originalScheduledAt: session.scheduledAt,
      });

      // Send email notification to mentee
      try {
        const emailService = getEmailService();
        const sessionType = formatSessionType(session.type);
        await emailService.sendSessionRescheduleDeclinedEmail(
          session.mentee.email,
          `${session.mentee.firstName} ${session.mentee.lastName}`,
          `${session.mentor.firstName} ${session.mentor.lastName}`,
          scheduledTimeFormatted,
          session.duration,
          sessionType,
          session.location,
          reason
        );
      } catch (emailError: any) {
        logger.error(
          'Failed to send session reschedule declined email',
          emailError
        );
      }

      // Create in-app notification for mentee
      try {
        const notificationService = getAppNotificationService();
        await notificationService.createNotification({
          userId: session.menteeId,
          type: AppNotificationType.RESCHEDULE_DECLINED,
          title: '❌ Reschedule Declined',
          message: `${session.mentor.firstName} ${
            session.mentor.lastName
          } declined your reschedule request. Original time: ${scheduledTimeFormatted}${
            reason ? `. Reason: ${reason}` : ''
          }`,
          data: {
            sessionId: session.id,
            mentorId: session.mentorId,
            scheduledAt: session.scheduledAt.toISOString(),
            reason,
          },
        });
      } catch (notifError: any) {
        logger.error('Failed to create in-app notification', notifError);
      }

      // Send push notification to mentee
      try {
        if (session.mentee?.pushToken) {
          const scheduledTimeFormatted = formatSessionTime(session.scheduledAt);
          await pushNotificationService.sendSessionStatusNotification(
            session.mentee.pushToken,
            session.mentee.id,
            `${session.mentor.firstName} ${session.mentor.lastName}`,
            'declined',
            scheduledTimeFormatted
          );
        }
      } catch (pushError: any) {
        logger.error('Failed to send session reschedule decline push notification', pushError);
      }

      return updatedSession;
    } catch (error: any) {
      logger.error('Error declining session reschedule', error);
      throw error;
    }
  }
}
