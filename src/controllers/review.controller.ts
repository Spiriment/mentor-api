import { Request, Response, NextFunction } from 'express';
import { ReviewService } from '../services/review.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export class ReviewController {
  private reviewService: ReviewService;
  private logger: Logger;

  constructor() {
    this.reviewService = new ReviewService();
    this.logger = new Logger({
      service: 'review-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Create a review for a mentor
   * POST /api/reviews
   */
  createReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      if (user.role !== 'mentee') {
        throw new AppError(
          'Only mentees can create reviews',
          StatusCodes.FORBIDDEN
        );
      }

      const { sessionId, rating, comment } = req.body;

      if (!sessionId || !rating || !comment) {
        throw new AppError(
          'Session ID, rating, and comment are required',
          StatusCodes.BAD_REQUEST
        );
      }

      const review = await this.reviewService.createReview(user.id, {
        sessionId,
        rating,
        comment,
      });

      return sendSuccessResponse(res, {
        review,
        message: 'Review created successfully',
      });
    } catch (error: any) {
      this.logger.error('Error creating review', error);
      next(error);
    }
  };

  /**
   * Get reviews for a mentor
   * GET /api/reviews/mentor/:mentorId
   */
  getMentorReviews = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { mentorId } = req.params;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : undefined;

      const result = await this.reviewService.getMentorReviews(mentorId, {
        limit,
        offset,
      });

      return sendSuccessResponse(res, {
        reviews: result.reviews,
        total: result.total,
        averageRating: result.averageRating,
        message: 'Reviews retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentor reviews', error);
      next(error);
    }
  };

  /**
   * Get review for a specific session
   * GET /api/reviews/session/:sessionId
   */
  getSessionReview = async (
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

      if (user.role !== 'mentee') {
        throw new AppError(
          'Only mentees can view their reviews',
          StatusCodes.FORBIDDEN
        );
      }

      const review = await this.reviewService.getSessionReview(
        sessionId,
        user.id
      );

      return sendSuccessResponse(res, {
        review,
        message: 'Review retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting session review', error);
      next(error);
    }
  };

  /**
   * Update review
   * PATCH /api/reviews/:reviewId
   */
  updateReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new AppError('User not authenticated', StatusCodes.UNAUTHORIZED);
      }

      if (user.role !== 'mentee') {
        throw new AppError(
          'Only mentees can update reviews',
          StatusCodes.FORBIDDEN
        );
      }

      const { reviewId } = req.params;
      const { rating, comment } = req.body;

      const review = await this.reviewService.updateReview(reviewId, user.id, {
        rating,
        comment,
      });

      return sendSuccessResponse(res, {
        review,
        message: 'Review updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating review', error);
      next(error);
    }
  };
}

