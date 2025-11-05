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
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

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

  /**
   * Create a new session
   */
  async createSession(data: CreateSessionDTO): Promise<Session> {
    try {
      // Validate mentor and mentee exist
      const mentor = await this.userRepository.findOne({
        where: { id: data.mentorId, role: 'mentor' },
      });

      if (!mentor) {
        throw new AppError('Mentor not found', StatusCodes.NOT_FOUND);
      }

      const mentee = await this.userRepository.findOne({
        where: { id: data.menteeId, role: 'mentee' },
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
        where: { id: data.mentorId, role: 'mentor' },
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
}
