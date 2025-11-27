import { Request, Response, NextFunction } from 'express';
import {
  SessionReviewService,
  CreateSessionReviewDTO,
  UpdateSessionReviewDTO,
} from '@/services/sessionReview.service';
import { logger } from '@/config/int-services';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '@/common/errors';

const sessionReviewService = new SessionReviewService();

export class SessionReviewController {
  /**
   * Create a session review
   * POST /api/session-reviews
   */
  async createReview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', StatusCodes.UNAUTHORIZED);
      }

      const data: CreateSessionReviewDTO = {
        sessionId: req.body.sessionId,
        menteeId: userId, // Use authenticated user ID
        sessionSummary: req.body.sessionSummary,
        rating: req.body.rating,
        reviewText: req.body.reviewText,
        learnings: req.body.learnings,
        topicsDiscussed: req.body.topicsDiscussed,
        nextSessionFocus: req.body.nextSessionFocus,
      };

      // Validate required fields
      if (!data.sessionId || !data.sessionSummary || !data.rating) {
        throw new AppError(
          'sessionId, sessionSummary, and rating are required',
          StatusCodes.BAD_REQUEST
        );
      }

      const review = await sessionReviewService.createReview(data);

      res.status(StatusCodes.CREATED).json({
        success: true,
        response: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get review by session ID
   * GET /api/session-reviews/session/:sessionId
   * Authorization: User must be either the mentee or mentor of the session
   */
  async getReviewBySessionId(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', StatusCodes.UNAUTHORIZED);
      }

      const { sessionId } = req.params;
      const review = await sessionReviewService.getReviewBySessionId(
        sessionId,
        userId
      );

      res.status(StatusCodes.OK).json({
        success: true,
        response: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get review by ID
   * GET /api/session-reviews/:reviewId
   */
  async getReviewById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reviewId } = req.params;
      const review = await sessionReviewService.getReviewById(reviewId);

      res.status(StatusCodes.OK).json({
        success: true,
        response: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reviews for a mentor
   * GET /api/session-reviews/mentor/:mentorId
   */
  async getMentorReviews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { mentorId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await sessionReviewService.getMentorReviews(
        mentorId,
        limit,
        offset
      );

      res.status(StatusCodes.OK).json({
        success: true,
        response: {
          reviews: result.reviews,
          total: result.total,
          pagination: {
            limit,
            offset,
            total: result.total,
            pages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reviews by a mentee
   * GET /api/session-reviews/mentee/:menteeId
   */
  async getMenteeReviews(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { menteeId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await sessionReviewService.getMenteeReviews(
        menteeId,
        limit,
        offset
      );

      res.status(StatusCodes.OK).json({
        success: true,
        response: {
          reviews: result.reviews,
          total: result.total,
          pagination: {
            limit,
            offset,
            total: result.total,
            pages: Math.ceil(result.total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a review
   * PATCH /api/session-reviews/:reviewId
   */
  async updateReview(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', StatusCodes.UNAUTHORIZED);
      }

      const { reviewId } = req.params;
      const data: UpdateSessionReviewDTO = {
        sessionSummary: req.body.sessionSummary,
        rating: req.body.rating,
        reviewText: req.body.reviewText,
        learnings: req.body.learnings,
        topicsDiscussed: req.body.topicsDiscussed,
        nextSessionFocus: req.body.nextSessionFocus,
      };

      const review = await sessionReviewService.updateReview(
        reviewId,
        userId,
        data
      );

      res.status(StatusCodes.OK).json({
        success: true,
        response: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark review as viewed by mentor
   * PATCH /api/session-reviews/:reviewId/viewed
   */
  async markAsViewed(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        throw new AppError('Unauthorized', StatusCodes.UNAUTHORIZED);
      }

      const { reviewId } = req.params;
      await sessionReviewService.markAsViewed(reviewId, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        response: { message: 'Review marked as viewed' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get mentor's average rating
   * GET /api/session-reviews/mentor/:mentorId/average
   */
  async getMentorAverageRating(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { mentorId } = req.params;
      const result = await sessionReviewService.getMentorAverageRating(
        mentorId
      );

      res.status(StatusCodes.OK).json({
        success: true,
        response: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
