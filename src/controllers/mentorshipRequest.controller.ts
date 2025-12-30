import { Request, Response, NextFunction } from 'express';
import { MentorshipRequestService } from '../services/mentorshipRequest.service';
import { AppError } from '../common/errors';
import { StatusCodes } from 'http-status-codes';
import { sendSuccessResponse } from '@/common/helpers';
import { logger } from '@/config/int-services';
import { MENTORSHIP_REQUEST_STATUS } from '../database/entities/mentorshipRequest.entity';

export class MentorshipRequestController {
  private requestService = new MentorshipRequestService();

  /**
   * Create a mentorship request
   * POST /api/mentorship-requests
   */
  createRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { mentorId, message } = req.body;

      if (!mentorId) {
        throw new AppError('Mentor ID is required', StatusCodes.BAD_REQUEST);
      }

      // Prevent requesting yourself
      if (mentorId === user.id) {
        throw new AppError('You cannot send a mentorship request to yourself', StatusCodes.BAD_REQUEST);
      }

      const { request, alreadyExists } = await this.requestService.createRequest({
        mentorId,
        menteeId: user.id,
        message,
      });

      logger.info('Mentorship request processed', {
        requestId: request.id,
        mentorId,
        menteeId: user.id,
        alreadyExists,
      });

      return sendSuccessResponse(
        res,
        {
          request,
          message: alreadyExists 
            ? 'You already have a pending mentorship request with this mentor.'
            : 'Mentorship request sent successfully',
          alreadyExists,
        },
        alreadyExists ? StatusCodes.OK : StatusCodes.CREATED
      );
    } catch (error: any) {
      logger.error('Error creating mentorship request', error);
      next(error);
    }
  };

  /**
   * Accept a mentorship request
   * POST /api/mentorship-requests/:requestId/accept
   */
  acceptRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { requestId } = req.params;
      const { responseMessage } = req.body;

      const request = await this.requestService.acceptRequest(requestId, user.id, responseMessage);

      logger.info('Mentorship request accepted successfully', {
        requestId,
        mentorId: user.id,
      });

      return sendSuccessResponse(res, {
        request,
        message: 'Mentorship request accepted successfully',
      });
    } catch (error: any) {
      logger.error('Error accepting mentorship request', error);
      next(error);
    }
  };

  /**
   * Decline a mentorship request
   * POST /api/mentorship-requests/:requestId/decline
   */
  declineRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { requestId } = req.params;
      const { responseMessage } = req.body;

      const request = await this.requestService.declineRequest(requestId, user.id, responseMessage);

      logger.info('Mentorship request declined successfully', {
        requestId,
        mentorId: user.id,
      });

      return sendSuccessResponse(res, {
        request,
        message: 'Mentorship request declined successfully',
      });
    } catch (error: any) {
      logger.error('Error declining mentorship request', error);
      next(error);
    }
  };

  /**
   * Cancel a mentorship request
   * POST /api/mentorship-requests/:requestId/cancel
   */
  cancelRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { requestId } = req.params;

      const request = await this.requestService.cancelRequest(requestId, user.id);

      logger.info('Mentorship request cancelled successfully', {
        requestId,
        menteeId: user.id,
      });

      return sendSuccessResponse(res, {
        request,
        message: 'Mentorship request cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Error cancelling mentorship request', error);
      next(error);
    }
  };

  /**
   * Get mentorship request status with a specific mentor
   * GET /api/mentorship-requests/status/:mentorId
   */
  getRequestStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { mentorId } = req.params;

      const request = await this.requestService.getRequestStatus(mentorId, user.id);

      logger.info('Mentorship request status fetched successfully', {
        mentorId,
        menteeId: user.id,
        hasRequest: !!request,
      });

      return sendSuccessResponse(res, {
        request,
        hasActiveMentorship: request?.status === MENTORSHIP_REQUEST_STATUS.ACCEPTED,
      });
    } catch (error: any) {
      logger.error('Error fetching mentorship request status', error);
      next(error);
    }
  };

  /**
   * Get all mentorship requests for the authenticated user
   * GET /api/mentorship-requests
   */
  getRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { status, type } = req.query;

      let requests;

      // Determine if user is checking as mentor or mentee
      if (type === 'mentor') {
        requests = await this.requestService.getMentorRequests(
          user.id,
          status as MENTORSHIP_REQUEST_STATUS | undefined
        );
      } else if (type === 'mentee') {
        requests = await this.requestService.getMenteeRequests(
          user.id,
          status as MENTORSHIP_REQUEST_STATUS | undefined
        );
      } else {
        // Default: return both
        const [mentorRequests, menteeRequests] = await Promise.all([
          this.requestService.getMentorRequests(user.id, status as MENTORSHIP_REQUEST_STATUS | undefined),
          this.requestService.getMenteeRequests(user.id, status as MENTORSHIP_REQUEST_STATUS | undefined),
        ]);

        requests = {
          asMentor: mentorRequests,
          asMentee: menteeRequests,
        };
      }

      logger.info('Mentorship requests fetched successfully', {
        userId: user.id,
        type,
        status,
      });

      return sendSuccessResponse(res, {
        requests,
      });
    } catch (error: any) {
      logger.error('Error fetching mentorship requests', error);
      next(error);
    }
  };

  /**
   * Check if mentee has active mentorship with mentor
   * GET /api/mentorship-requests/check/:mentorId
   */
  checkActiveMentorship = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      const { mentorId } = req.params;

      const hasActiveMentorship = await this.requestService.hasActiveMentorship(mentorId, user.id);

      logger.info('Active mentorship check completed', {
        mentorId,
        menteeId: user.id,
        hasActiveMentorship,
      });

      return sendSuccessResponse(res, {
        hasActiveMentorship,
      });
    } catch (error: any) {
      logger.error('Error checking active mentorship', error);
      next(error);
    }
  };
}
