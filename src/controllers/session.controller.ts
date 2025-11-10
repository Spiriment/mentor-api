import { Request, Response, NextFunction } from 'express';
import {
  SessionService,
  CreateSessionDTO,
  UpdateSessionDTO,
  CreateAvailabilityDTO,
} from '../services/session.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import {
  SESSION_STATUS,
  SESSION_TYPE,
  SESSION_DURATION,
} from '@/database/entities/session.entity';
import { DAY_OF_WEEK } from '@/database/entities/mentorAvailability.entity';

export class SessionController {
  private sessionService: SessionService;
  private logger: Logger;

  constructor() {
    this.sessionService = new SessionService();
    this.logger = new Logger({
      service: 'session-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Create a new session
   * POST /api/sessions
   */
  createSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      if (user.role !== 'mentee') {
        throw new AppError(
          'Only mentees can create sessions',
          StatusCodes.FORBIDDEN
        );
      }

      const sessionData: CreateSessionDTO = {
        mentorId: req.body.mentorId,
        menteeId: user.id,
        scheduledAt: new Date(req.body.scheduledAt),
        type: req.body.type,
        duration: req.body.duration,
        title: req.body.title,
        description: req.body.description,
        meetingLink: req.body.meetingLink,
        meetingId: req.body.meetingId,
        meetingPassword: req.body.meetingPassword,
        location: req.body.location,
        isRecurring: req.body.isRecurring,
        recurringPattern: req.body.recurringPattern,
      };

      const session = await this.sessionService.createSession(sessionData);

      this.logger.info('Session created successfully', {
        sessionId: session.id,
        mentorId: sessionData.mentorId,
        menteeId: sessionData.menteeId,
      });

      return sendSuccessResponse(
        res,
        {
          session,
          message: 'Session created successfully',
        },
        StatusCodes.CREATED
      );
    } catch (error: any) {
      this.logger.error('Error creating session', error);
      next(error);
    }
  };

  /**
   * Update session details
   * PUT /api/sessions/:sessionId
   */
  updateSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const updateData: UpdateSessionDTO = req.body;

      const session = await this.sessionService.updateSession(
        sessionId,
        updateData,
        user.id
      );

      this.logger.info('Session updated successfully', {
        sessionId,
        userId: user.id,
      });

      return sendSuccessResponse(res, {
        session,
        message: 'Session updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating session', error);
      next(error);
    }
  };

  /**
   * Get user's sessions
   * GET /api/sessions
   */
  getUserSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      if (!user.role || (user.role !== 'mentor' && user.role !== 'mentee')) {
        throw new AppError('Invalid user role', StatusCodes.BAD_REQUEST);
      }

      const options = {
        status: req.query.status as SESSION_STATUS,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        upcoming: req.query.upcoming === 'true',
      };

      const result = await this.sessionService.getUserSessions(
        user.id,
        user.role,
        options
      );

      return sendSuccessResponse(res, {
        sessions: result.sessions,
        total: result.total,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: result.total,
          pages: Math.ceil(result.total / options.limit),
        },
        message: 'Sessions retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting user sessions', error);
      next(error);
    }
  };

  /**
   * Get a specific session
   * GET /api/sessions/:sessionId
   */
  getSessionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const session = await this.sessionService.getSessionById(
        sessionId,
        user.id
      );

      return sendSuccessResponse(res, {
        session,
        message: 'Session retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting session by ID', error);
      next(error);
    }
  };

  /**
   * Cancel a session
   * DELETE /api/sessions/:sessionId
   */
  cancelSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const reason = req.body.reason;

      const session = await this.sessionService.cancelSession(
        sessionId,
        user.id,
        reason
      );

      this.logger.info('Session cancelled successfully', {
        sessionId,
        userId: user.id,
      });

      return sendSuccessResponse(res, {
        session,
        message: 'Session cancelled successfully',
      });
    } catch (error: any) {
      this.logger.error('Error cancelling session', error);
      next(error);
    }
  };

  /**
   * Get mentor availability
   * GET /api/sessions/mentor/:mentorId/availability
   */
  getMentorAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { mentorId } = req.params;
      const availability = await this.sessionService.getMentorAvailability(
        mentorId
      );

      return sendSuccessResponse(res, {
        availability,
        message: 'Mentor availability retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentor availability', error);
      next(error);
    }
  };

  /**
   * Get available time slots for a mentor on a specific date
   * GET /api/sessions/mentor/:mentorId/availability/:date
   */
  getAvailableSlots = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { mentorId, date } = req.params;
      const requestedDate = new Date(date);

      if (isNaN(requestedDate.getTime())) {
        throw new AppError('Invalid date format', StatusCodes.BAD_REQUEST);
      }

      const slots = await this.sessionService.getAvailableSlots(
        mentorId,
        requestedDate
      );

      return sendSuccessResponse(res, {
        mentorId,
        date: requestedDate.toISOString().split('T')[0],
        slots,
        message: 'Available slots retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting available slots', error);
      next(error);
    }
  };

  /**
   * Create mentor availability
   * POST /api/sessions/availability
   */
  createAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can set availability',
          StatusCodes.FORBIDDEN
        );
      }

      const availabilityData: CreateAvailabilityDTO = {
        mentorId: user.id,
        dayOfWeek: req.body.dayOfWeek,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        slotDuration: req.body.slotDuration,
        timezone: req.body.timezone,
        specificDate: req.body.specificDate
          ? new Date(req.body.specificDate)
          : undefined,
        breaks: req.body.breaks,
        notes: req.body.notes,
      };

      const availability = await this.sessionService.createAvailability(
        availabilityData
      );

      this.logger.info('Mentor availability created successfully', {
        availabilityId: availability.id,
        mentorId: user.id,
      });

      return sendSuccessResponse(
        res,
        {
          availability,
          message: 'Availability created successfully',
        },
        StatusCodes.CREATED
      );
    } catch (error: any) {
      this.logger.error('Error creating availability', error);
      next(error);
    }
  };

  /**
   * Reschedule a session (mentor suggests new time)
   * PATCH /api/sessions/:sessionId/reschedule
   */
  rescheduleSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can reschedule sessions',
          StatusCodes.FORBIDDEN
        );
      }

      const { sessionId } = req.params;
      const { newScheduledAt, reason, message } = req.body;

      if (!newScheduledAt) {
        throw new AppError(
          'newScheduledAt is required',
          StatusCodes.BAD_REQUEST
        );
      }

      const session = await this.sessionService.rescheduleSession(
        sessionId,
        user.id,
        new Date(newScheduledAt),
        reason,
        message
      );

      this.logger.info('Session rescheduled successfully', {
        sessionId,
        mentorId: user.id,
        newScheduledAt,
      });

      return sendSuccessResponse(res, {
        session,
        message: 'Session rescheduled successfully. The mentee will be notified.',
      });
    } catch (error: any) {
      this.logger.error('Error rescheduling session', error);
      next(error);
    }
  };

  /**
   * Confirm session attendance
   * PATCH /api/sessions/:sessionId/confirm
   */
  confirmSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const confirmType = user.role === 'mentor' ? 'mentor' : 'mentee';

      const session = await this.sessionService.confirmSession(
        sessionId,
        user.id,
        confirmType
      );

      this.logger.info('Session attendance confirmed', {
        sessionId,
        userId: user.id,
        confirmType,
      });

      return sendSuccessResponse(res, {
        session,
        message: 'Session attendance confirmed successfully',
      });
    } catch (error: any) {
      this.logger.error('Error confirming session', error);
      next(error);
    }
  };

  /**
   * Update session status (for starting/ending sessions)
   * PATCH /api/sessions/:sessionId/status
   */
  updateSessionStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const { status } = req.body;

      if (!Object.values(SESSION_STATUS).includes(status)) {
        throw new AppError('Invalid session status', StatusCodes.BAD_REQUEST);
      }

      const updateData: UpdateSessionDTO = { status };

      // Add timestamps based on status
      if (status === SESSION_STATUS.IN_PROGRESS) {
        updateData.startedAt = new Date();
      } else if (status === SESSION_STATUS.COMPLETED) {
        updateData.endedAt = new Date();
      }

      const session = await this.sessionService.updateSession(
        sessionId,
        updateData,
        user.id
      );

      this.logger.info('Session status updated successfully', {
        sessionId,
        status,
        userId: user.id,
      });

      return sendSuccessResponse(res, {
        session,
        message: 'Session status updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating session status', error);
      next(error);
    }
  };

  /**
   * Add session notes (mentor or mentee)
   * PATCH /api/sessions/:sessionId/notes
   */
  addSessionNotes = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const { notes, summary, assignments } = req.body;

      // Get session to verify user is part of it
      const session = await this.sessionService.getSessionById(
        sessionId,
        user.id
      );

      // Determine which notes field to update based on user role
      const updateData: any = {};

      if (notes !== undefined) {
        if (user.role === 'mentor') {
          updateData.mentorNotes = notes;
        } else {
          updateData.menteeNotes = notes;
        }
      }

      if (summary !== undefined) {
        updateData.sessionSummary = summary;
      }

      if (assignments !== undefined) {
        updateData.assignments = Array.isArray(assignments)
          ? assignments
          : [assignments];
      }

      const updatedSession = await this.sessionService.updateSession(
        sessionId,
        updateData,
        user.id
      );

      return sendSuccessResponse(res, {
        session: updatedSession,
        message: 'Session notes updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error adding session notes', error);
      next(error);
    }
  };
}
