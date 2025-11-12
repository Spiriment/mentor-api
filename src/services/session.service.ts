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
import {
  AppNotification,
  AppNotificationType,
} from '@/database/entities/appNotification.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { USER_ROLE } from '@/common/constants';
import { EmailService } from '@/core/email.service';
import { format } from 'date-fns';

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
  private notificationRepository = AppDataSource.getRepository(AppNotification);
  private emailService: EmailService;

  constructor() {
    // Initialize EmailService without queue for direct sending
    this.emailService = new EmailService(null);
  }

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

      // Check if mentor is available at the requested time
      const isAvailable = await this.isMentorAvailable(
        data.mentorId,
        data.scheduledAt
      );
      if (!isAvailable) {
        throw new AppError(
          'Mentor is not available at the requested time',
          StatusCodes.CONFLICT
        );
      }

      // Create session
      const session = this.sessionRepository.create({
        mentorId: data.mentorId,
        menteeId: data.menteeId,
        scheduledAt: data.scheduledAt,
        type: data.type || SESSION_TYPE.ONE_ON_ONE,
        duration: data.duration || SESSION_DURATION.ONE_HOUR,
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

      const savedSession = await this.sessionRepository.save(session);

      // Load relations for email notification
      const sessionWithRelations = await this.sessionRepository.findOne({
        where: { id: savedSession.id },
        relations: ['mentor', 'mentee'],
      });

      // Send email and in-app notification to mentor
      if (sessionWithRelations) {
        await this.sendSessionRequestEmail(sessionWithRelations).catch((error) => {
          logger.error('Failed to send session request email', error);
          // Don't throw - email failure shouldn't break session creation
        });

        // Create in-app notification for mentor
        // Note: This is non-blocking - if the table doesn't exist, it will fail gracefully
        await this.createInAppNotification({
          userId: sessionWithRelations.mentorId,
          type: AppNotificationType.SESSION_REQUEST,
          title: 'New Session Request',
          message: `${sessionWithRelations.mentee?.firstName || 'A mentee'} has requested a session with you`,
          data: {
            sessionId: sessionWithRelations.id,
            menteeId: sessionWithRelations.menteeId,
          },
        }).catch((error: any) => {
          // Log error but don't break session creation
          // This can happen if the app_notifications table hasn't been created yet
          if (error?.message?.includes("doesn't exist")) {
            logger.warn('In-app notifications table not found. Run migrations to enable notifications.', {
              table: 'app_notifications',
              sessionId: sessionWithRelations.id,
            });
          } else {
            logger.error('Failed to create in-app notification', error);
          }
        });
      }

      logger.info('Session created successfully', {
        sessionId: savedSession.id,
        mentorId: data.mentorId,
        menteeId: data.menteeId,
        scheduledAt: data.scheduledAt,
      });

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

      // Check if status is being changed to confirmed
      const wasConfirmed = session.status === SESSION_STATUS.CONFIRMED;
      const isBeingConfirmed = data.status === SESSION_STATUS.CONFIRMED;

      // Update session fields
      Object.assign(session, data);
      const updatedSession = await this.sessionRepository.save(session);

      // Send email notification if status changed to confirmed
      // Reload with relations for email
      if (!wasConfirmed && isBeingConfirmed) {
        const sessionWithRelations = await this.sessionRepository.findOne({
          where: { id: updatedSession.id },
          relations: ['mentor', 'mentee'],
        });
        
        if (sessionWithRelations) {
          await this.sendSessionConfirmedEmail(sessionWithRelations).catch((error) => {
            logger.error('Failed to send session confirmed email', error);
            // Don't throw - email failure shouldn't break session update
          });

          // Create in-app notifications for both parties
          await this.createInAppNotification({
            userId: sessionWithRelations.menteeId,
            type: AppNotificationType.SESSION_CONFIRMED,
            title: 'Session Confirmed',
            message: `Your session with ${sessionWithRelations.mentor?.firstName || 'your mentor'} has been confirmed`,
            data: {
              sessionId: sessionWithRelations.id,
              mentorId: sessionWithRelations.mentorId,
            },
          }).catch((error: any) => {
            if (error?.message?.includes("doesn't exist")) {
              logger.warn('In-app notifications table not found. Run migrations to enable notifications.', {
                table: 'app_notifications',
                sessionId: sessionWithRelations.id,
              });
            } else {
              logger.error('Failed to create in-app notification for mentee', error);
            }
          });

          await this.createInAppNotification({
            userId: sessionWithRelations.mentorId,
            type: AppNotificationType.SESSION_CONFIRMED,
            title: 'Session Confirmed',
            message: `You confirmed a session with ${sessionWithRelations.mentee?.firstName || 'your mentee'}`,
            data: {
              sessionId: sessionWithRelations.id,
              menteeId: sessionWithRelations.menteeId,
            },
          }).catch((error: any) => {
            if (error?.message?.includes("doesn't exist")) {
              logger.warn('In-app notifications table not found. Run migrations to enable notifications.', {
                table: 'app_notifications',
                sessionId: sessionWithRelations.id,
              });
            } else {
              logger.error('Failed to create in-app notification for mentor', error);
            }
          });
        }
      }

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
    } = {}
  ): Promise<{ sessions: Session[]; total: number }> {
    try {
      const queryBuilder = this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentor', 'mentor')
        .leftJoinAndSelect('session.mentee', 'mentee');

      if (userRole === 'mentor') {
        queryBuilder.where('session.mentorId = :userId', { userId });
      } else {
        queryBuilder.where('session.menteeId = :userId', { userId });
      }

      if (options.status) {
        queryBuilder.andWhere('session.status = :status', {
          status: options.status,
        });
      }

      if (options.upcoming) {
        queryBuilder.andWhere('session.scheduledAt > :now', {
          now: new Date(),
        });
      }

      queryBuilder
        .orderBy('session.scheduledAt', 'ASC')
        .skip(options.offset || 0)
        .take(options.limit || 20);

      const [sessions, total] = await queryBuilder.getManyAndCount();

      return { sessions, total };
    } catch (error: any) {
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
   * Reschedule a session (mentor suggests new time)
   */
  async rescheduleSession(
    sessionId: string,
    mentorId: string,
    newScheduledAt: Date,
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

      // Only mentor can reschedule
      if (session.mentorId !== mentorId) {
        throw new AppError(
          'Only the mentor can reschedule this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if session can be rescheduled
      if (session.status === SESSION_STATUS.CANCELLED) {
        throw new AppError(
          'Cannot reschedule a cancelled session',
          StatusCodes.BAD_REQUEST
        );
      }

      if (session.status === SESSION_STATUS.COMPLETED) {
        throw new AppError(
          'Cannot reschedule a completed session',
          StatusCodes.BAD_REQUEST
        );
      }

      // Check if mentor is available at new time
      const isAvailable = await this.isMentorAvailable(mentorId, newScheduledAt);
      if (!isAvailable) {
        throw new AppError(
          'Mentor is not available at the requested time',
          StatusCodes.CONFLICT
        );
      }

      // Store old scheduled time for logging
      const oldScheduledAt = session.scheduledAt;

      // Update session with new time and status
      session.scheduledAt = newScheduledAt;
      session.status = SESSION_STATUS.RESCHEDULED;
      if (reason) {
        session.cancellationReason = reason;
      }
      if (message) {
        session.mentorNotes = message;
      }

      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session rescheduled successfully', {
        sessionId,
        mentorId,
        oldScheduledAt,
        newScheduledAt,
        reason,
      });

      return updatedSession;
    } catch (error: any) {
      logger.error('Error rescheduling session', error);
      throw error;
    }
  }

  /**
   * Confirm session attendance (mentor or mentee)
   */
  async confirmSession(
    sessionId: string,
    userId: string,
    confirmType: 'mentor' | 'mentee'
  ): Promise<Session> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Check if user has permission
      if (confirmType === 'mentor' && session.mentorId !== userId) {
        throw new AppError(
          'Only the mentor can confirm as mentor',
          StatusCodes.FORBIDDEN
        );
      }

      if (confirmType === 'mentee' && session.menteeId !== userId) {
        throw new AppError(
          'Only the mentee can confirm as mentee',
          StatusCodes.FORBIDDEN
        );
      }

      // Only confirmed sessions can be confirmed for attendance
      if (session.status !== SESSION_STATUS.CONFIRMED) {
        throw new AppError(
          'Only confirmed sessions can be confirmed for attendance',
          StatusCodes.BAD_REQUEST
        );
      }

      // Update confirmation status
      if (confirmType === 'mentor') {
        session.mentorConfirmed = true;
      } else {
        session.menteeConfirmed = true;
      }

      const updatedSession = await this.sessionRepository.save(session);

      logger.info('Session attendance confirmed', {
        sessionId,
        userId,
        confirmType,
      });

      return updatedSession;
    } catch (error: any) {
      logger.error('Error confirming session', error);
      throw error;
    }
  }

  /**
   * Check if mentor is available at a specific time
   */
  async isMentorAvailable(
    mentorId: string,
    requestedTime: Date
  ): Promise<boolean> {
    try {
      const dayOfWeek = requestedTime.getDay() as DAY_OF_WEEK;
      const timeString = requestedTime.toTimeString().slice(0, 8); // HH:MM:SS format

      // Check recurring availability
      const availability = await this.availabilityRepository.findOne({
        where: {
          mentorId,
          dayOfWeek,
          status: AVAILABILITY_STATUS.AVAILABLE,
          isRecurring: true,
        },
      });

      if (!availability) {
        return false;
      }

      // Check if requested time is within available hours
      if (
        timeString < availability.startTime ||
        timeString > availability.endTime
      ) {
        return false;
      }

      // Check for breaks
      if (availability.breaks) {
        for (const breakPeriod of availability.breaks) {
          if (
            timeString >= breakPeriod.startTime &&
            timeString <= breakPeriod.endTime
          ) {
            return false;
          }
        }
      }

      // Check if there's already a session at this time (scheduled or confirmed)
      const existingSession = await this.sessionRepository.findOne({
        where: [
          {
            mentorId,
            scheduledAt: requestedTime,
            status: SESSION_STATUS.SCHEDULED,
          },
          {
            mentorId,
            scheduledAt: requestedTime,
            status: SESSION_STATUS.CONFIRMED,
          },
        ],
      });

      if (existingSession) {
        return false;
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

        const updatedAvailability =
          await this.availabilityRepository.save(existingAvailability);

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
   * Get available time slots for a mentor on a specific date
   */
  async getAvailableSlots(
    mentorId: string,
    date: Date
  ): Promise<Array<{ time: string; available: boolean }>> {
    try {
      const dayOfWeek = date.getDay() as DAY_OF_WEEK;
      const availability = await this.availabilityRepository.findOne({
        where: {
          mentorId,
          dayOfWeek,
          status: AVAILABILITY_STATUS.AVAILABLE,
        },
      });

      if (!availability) {
        return [];
      }

      const slots: Array<{ time: string; available: boolean }> = [];
      const startTime = new Date(`1970-01-01T${availability.startTime}`);
      const endTime = new Date(`1970-01-01T${availability.endTime}`);
      const slotDuration = availability.slotDuration;

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

        // Check if there's already a session at this time
        const sessionDateTime = new Date(date);
        sessionDateTime.setHours(
          currentTime.getHours(),
          currentTime.getMinutes(),
          0,
          0
        );

        // Check for existing sessions (scheduled or confirmed) at this time
        const existingSession = await this.sessionRepository.findOne({
          where: [
            {
              mentorId,
              scheduledAt: sessionDateTime,
              status: SESSION_STATUS.SCHEDULED,
            },
            {
              mentorId,
              scheduledAt: sessionDateTime,
              status: SESSION_STATUS.CONFIRMED,
            },
          ],
        });

        slots.push({
          time: timeString,
          available: !isInBreak && !existingSession,
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
   * Send email notification when mentee requests a session
   */
  private async sendSessionRequestEmail(session: Session): Promise<void> {
    if (!session.mentor || !session.mentor.email) {
      logger.warn(`Mentor email not found for session ${session.id}`);
      return;
    }

    if (!session.mentee) {
      logger.warn(`Mentee not found for session ${session.id}`);
      return;
    }

    const scheduledTime = new Date(session.scheduledAt);
    const formattedTime = format(
      scheduledTime,
      'EEEE, MMMM d, yyyy "at" h:mm a'
    );
    const menteeName = session.mentee
      ? `${session.mentee.firstName || ''} ${session.mentee.lastName || ''}`.trim() || session.mentee.email
      : 'A mentee';

    const message =
      `You have received a new session request!\n\n` +
      `Session Details:\n` +
      `- Requested by: ${menteeName}\n` +
      `- Date & Time: ${formattedTime}\n` +
      `- Duration: ${session.duration} minutes\n` +
      `${session.description ? `- Description: ${session.description}\n` : ''}\n` +
      `\nPlease open the Mentor App to review and respond to this request.`;

    await this.emailService.sendNotificationEmail({
      to: session.mentor.email,
      subject: `📅 New Session Request from ${menteeName}`,
      message,
      userName: session.mentor.firstName || session.mentor.email,
      type: 'Session Request',
      priority: 'medium',
      title: 'New Session Request',
      actionUrl: `/sessions/${session.id}`,
      actionText: 'View Session Request',
    });

    logger.info(
      `Session request email sent to mentor ${session.mentor.email} for session ${session.id}`
    );
  }

  /**
   * Send email notification when mentor confirms a session
   */
  private async sendSessionConfirmedEmail(session: Session): Promise<void> {
    if (!session.mentor || !session.mentee) {
      logger.warn(`Session relations not loaded for session ${session.id}`);
      return;
    }

    const scheduledTime = new Date(session.scheduledAt);
    const formattedTime = format(
      scheduledTime,
      'EEEE, MMMM d, yyyy "at" h:mm a'
    );

    // Send to mentee
    if (session.mentee.email) {
      const mentorName = session.mentor
        ? `${session.mentor.firstName || ''} ${session.mentor.lastName || ''}`.trim() || session.mentor.email
        : 'Your mentor';

      const menteeMessage =
        `Great news! Your session request has been confirmed.\n\n` +
        `Session Details:\n` +
        `- With: ${mentorName}\n` +
        `- Date & Time: ${formattedTime}\n` +
        `- Duration: ${session.duration} minutes\n` +
        `${session.description ? `- Description: ${session.description}\n` : ''}\n` +
        `\nPlease open the Mentor App to view your confirmed session.`;

      await this.emailService.sendNotificationEmail({
        to: session.mentee.email,
        subject: `✅ Session Confirmed with ${mentorName}`,
        message: menteeMessage,
        userName: session.mentee.firstName || session.mentee.email,
        type: 'Session Confirmed',
        priority: 'high',
        title: 'Session Confirmed',
        actionUrl: `/sessions/${session.id}`,
        actionText: 'View Session',
      }).catch((error) => {
        logger.error('Failed to send confirmation email to mentee', error);
      });

      logger.info(
        `Session confirmed email sent to mentee ${session.mentee.email} for session ${session.id}`
      );
    }

    // Send to mentor
    if (session.mentor.email) {
      const menteeName = session.mentee
        ? `${session.mentee.firstName || ''} ${session.mentee.lastName || ''}`.trim() || session.mentee.email
        : 'Your mentee';

      const mentorMessage =
        `You have confirmed a session request.\n\n` +
        `Session Details:\n` +
        `- With: ${menteeName}\n` +
        `- Date & Time: ${formattedTime}\n` +
        `- Duration: ${session.duration} minutes\n` +
        `${session.description ? `- Description: ${session.description}\n` : ''}\n` +
        `\nPlease open the Mentor App to view your confirmed session.`;

      await this.emailService.sendNotificationEmail({
        to: session.mentor.email,
        subject: `✅ Session Confirmed with ${menteeName}`,
        message: mentorMessage,
        userName: session.mentor.firstName || session.mentor.email,
        type: 'Session Confirmed',
        priority: 'high',
        title: 'Session Confirmed',
        actionUrl: `/sessions/${session.id}`,
        actionText: 'View Session',
      }).catch((error) => {
        logger.error('Failed to send confirmation email to mentor', error);
      });

      logger.info(
        `Session confirmed email sent to mentor ${session.mentor.email} for session ${session.id}`
      );
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(data: {
    userId: string;
    type: AppNotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<AppNotification> {
    const notification = this.notificationRepository.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      isRead: false,
    });

    const savedNotification = await this.notificationRepository.save(notification);
    logger.info('In-app notification created', {
      notificationId: savedNotification.id,
      userId: data.userId,
      type: data.type,
    });

    return savedNotification;
  }
}
