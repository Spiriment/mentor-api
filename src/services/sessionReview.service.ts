import { AppDataSource } from '@/config/data-source';
import { SessionReview } from '@/database/entities/sessionReview.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '@/database/entities/appNotification.entity';
import { formatUserName } from './emailHelper';

export interface CreateSessionReviewDTO {
  sessionId: string;
  menteeId: string;
  sessionSummary: string;
  rating: number;
  reviewText?: string;
  learnings?: string;
  topicsDiscussed?: string[];
  nextSessionFocus?: string;
}

export interface UpdateSessionReviewDTO {
  sessionSummary?: string;
  rating?: number;
  reviewText?: string;
  learnings?: string;
  topicsDiscussed?: string[];
  nextSessionFocus?: string;
}

export class SessionReviewService {
  private sessionReviewRepository = AppDataSource.getRepository(SessionReview);
  private sessionRepository = AppDataSource.getRepository(Session);
  private userRepository = AppDataSource.getRepository(User);

  /**
   * Create a session review (mentee only)
   */
  async createReview(data: CreateSessionReviewDTO): Promise<SessionReview> {
    try {
      // Validate session exists and is completed
      const session = await this.sessionRepository.findOne({
        where: { id: data.sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Verify the mentee is the one creating the review
      if (session.menteeId !== data.menteeId) {
        throw new AppError(
          'Only the mentee can create a review for this session',
          StatusCodes.FORBIDDEN
        );
      }

      // Only allow reviews for completed sessions
      if (session.status !== SESSION_STATUS.COMPLETED) {
        throw new AppError(
          'Reviews can only be submitted for completed sessions',
          StatusCodes.BAD_REQUEST
        );
      }

      // Check if review already exists
      const existingReview = await this.sessionReviewRepository.findOne({
        where: { sessionId: data.sessionId },
      });

      if (existingReview) {
        throw new AppError(
          'A review already exists for this session',
          StatusCodes.CONFLICT
        );
      }

      // Validate rating
      if (data.rating < 1 || data.rating > 5) {
        throw new AppError(
          'Rating must be between 1 and 5',
          StatusCodes.BAD_REQUEST
        );
      }

      // Create the review
      const review = this.sessionReviewRepository.create({
        sessionId: data.sessionId,
        menteeId: data.menteeId,
        mentorId: session.mentorId,
        sessionSummary: data.sessionSummary,
        rating: data.rating,
        reviewText: data.reviewText,
        learnings: data.learnings,
        topicsDiscussed: data.topicsDiscussed,
        nextSessionFocus: data.nextSessionFocus,
      });

      const savedReview = await this.sessionReviewRepository.save(review);

      // Send notification to mentor
      try {
        const notificationService = getAppNotificationService();
        await notificationService.createNotification({
          userId: session.mentorId,
          type: AppNotificationType.SESSION_REVIEW_SUBMITTED,
          title: '⭐ New Session Review',
          message: `${formatUserName(session.mentee)} submitted a ${data.rating}-star review for your session`,
          data: {
            sessionId: session.id,
            reviewId: savedReview.id,
            menteeId: session.menteeId,
            menteeName: formatUserName(session.mentee),
            rating: data.rating,
          },
        });

        logger.info('Session review notification sent', {
          mentorId: session.mentorId,
          sessionId: session.id,
          reviewId: savedReview.id,
        });
      } catch (notifError: any) {
        logger.error('Failed to send review notification', notifError);
        // Don't throw - review was saved successfully
      }

      logger.info('Session review created', {
        reviewId: savedReview.id,
        sessionId: data.sessionId,
        menteeId: data.menteeId,
        rating: data.rating,
      });

      return savedReview;
    } catch (error: any) {
      logger.error('Error creating session review', error);
      throw error;
    }
  }

  /**
   * Get a review by session ID
   * Authorization: User must be either the mentee or mentor of the session
   */
  async getReviewBySessionId(
    sessionId: string,
    userId: string
  ): Promise<SessionReview | null> {
    try {
      // First verify the session exists and user has access
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        select: ['id', 'mentorId', 'menteeId'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      // Verify user is either the mentee or mentor
      if (session.menteeId !== userId && session.mentorId !== userId) {
        throw new AppError(
          'You do not have permission to view this review',
          StatusCodes.FORBIDDEN
        );
      }

      const review = await this.sessionReviewRepository.findOne({
        where: { sessionId },
        relations: ['mentee', 'mentor', 'session'],
      });

      return review;
    } catch (error: any) {
      logger.error('Error getting review by session ID', error);
      throw error;
    }
  }

  /**
   * Get a review by ID
   */
  async getReviewById(reviewId: string): Promise<SessionReview> {
    try {
      const review = await this.sessionReviewRepository.findOne({
        where: { id: reviewId },
        relations: ['mentee', 'mentor', 'session'],
      });

      if (!review) {
        throw new AppError('Review not found', StatusCodes.NOT_FOUND);
      }

      return review;
    } catch (error: any) {
      logger.error('Error getting review by ID', error);
      throw error;
    }
  }

  /**
   * Get all reviews for a mentor
   */
  async getMentorReviews(
    mentorId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ reviews: SessionReview[]; total: number }> {
    try {
      const [reviews, total] = await this.sessionReviewRepository.findAndCount({
        where: { mentorId },
        relations: ['mentee', 'session'],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      return { reviews, total };
    } catch (error: any) {
      logger.error('Error getting mentor reviews', error);
      throw error;
    }
  }

  /**
   * Get all reviews by a mentee
   */
  async getMenteeReviews(
    menteeId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ reviews: SessionReview[]; total: number }> {
    try {
      const [reviews, total] = await this.sessionReviewRepository.findAndCount({
        where: { menteeId },
        relations: ['mentor', 'session'],
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      return { reviews, total };
    } catch (error: any) {
      logger.error('Error getting mentee reviews', error);
      throw error;
    }
  }

  /**
   * Update a review (mentee only, within 24 hours)
   */
  async updateReview(
    reviewId: string,
    menteeId: string,
    data: UpdateSessionReviewDTO
  ): Promise<SessionReview> {
    try {
      const review = await this.sessionReviewRepository.findOne({
        where: { id: reviewId },
      });

      if (!review) {
        throw new AppError('Review not found', StatusCodes.NOT_FOUND);
      }

      // Verify the mentee is the owner
      if (review.menteeId !== menteeId) {
        throw new AppError(
          'Only the review author can update this review',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if review is less than 24 hours old
      const hoursSinceCreation =
        (Date.now() - new Date(review.createdAt).getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreation > 24) {
        throw new AppError(
          'Reviews can only be edited within 24 hours of creation',
          StatusCodes.BAD_REQUEST
        );
      }

      // Validate rating if provided
      if (data.rating && (data.rating < 1 || data.rating > 5)) {
        throw new AppError(
          'Rating must be between 1 and 5',
          StatusCodes.BAD_REQUEST
        );
      }

      // Update the review
      Object.assign(review, data);
      const updatedReview = await this.sessionReviewRepository.save(review);

      logger.info('Session review updated', {
        reviewId,
        menteeId,
      });

      return updatedReview;
    } catch (error: any) {
      logger.error('Error updating session review', error);
      throw error;
    }
  }

  /**
   * Mark review as viewed by mentor
   */
  async markAsViewed(reviewId: string, mentorId: string): Promise<void> {
    try {
      const review = await this.sessionReviewRepository.findOne({
        where: { id: reviewId },
      });

      if (!review) {
        throw new AppError('Review not found', StatusCodes.NOT_FOUND);
      }

      // Verify the mentor is the recipient
      if (review.mentorId !== mentorId) {
        throw new AppError(
          'Only the mentor can mark this review as viewed',
          StatusCodes.FORBIDDEN
        );
      }

      review.mentorViewed = true;
      review.mentorViewedAt = new Date();

      await this.sessionReviewRepository.save(review);

      logger.info('Review marked as viewed', {
        reviewId,
        mentorId,
      });
    } catch (error: any) {
      logger.error('Error marking review as viewed', error);
      throw error;
    }
  }

  /**
   * Get mentor's average rating
   */
  async getMentorAverageRating(mentorId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    try {
      const result = await this.sessionReviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'averageRating')
        .addSelect('COUNT(review.id)', 'totalReviews')
        .where('review.mentorId = :mentorId', { mentorId })
        .getRawOne();

      return {
        averageRating: parseFloat(result.averageRating) || 0,
        totalReviews: parseInt(result.totalReviews) || 0,
      };
    } catch (error: any) {
      logger.error('Error getting mentor average rating', error);
      throw error;
    }
  }

  /**
   * Delete a review (admin only - not exposed to regular users)
   */
  async deleteReview(reviewId: string): Promise<void> {
    try {
      const result = await this.sessionReviewRepository.delete(reviewId);

      if (result.affected === 0) {
        throw new AppError('Review not found', StatusCodes.NOT_FOUND);
      }

      logger.info('Session review deleted', { reviewId });
    } catch (error: any) {
      logger.error('Error deleting session review', error);
      throw error;
    }
  }
}
