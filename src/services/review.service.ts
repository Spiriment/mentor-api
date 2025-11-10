import { AppDataSource } from '@/config/data-source';
import { Review } from '@/database/entities/review.entity';
import { Session } from '@/database/entities/session.entity';
import { logger } from '@/config/int-services';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export interface CreateReviewDTO {
  sessionId: string;
  rating: number; // 1-5
  comment: string;
}

export class ReviewService {
  private reviewRepository = AppDataSource.getRepository(Review);
  private sessionRepository = AppDataSource.getRepository(Session);

  /**
   * Create a review for a mentor (by mentee)
   */
  async createReview(
    menteeId: string,
    data: CreateReviewDTO
  ): Promise<Review> {
    try {
      // Validate rating
      if (data.rating < 1 || data.rating > 5) {
        throw new AppError(
          'Rating must be between 1 and 5',
          StatusCodes.BAD_REQUEST
        );
      }

      // Verify session exists and mentee is part of it
      const session = await this.sessionRepository.findOne({
        where: { id: data.sessionId },
        relations: ['mentor', 'mentee'],
      });

      if (!session) {
        throw new AppError('Session not found', StatusCodes.NOT_FOUND);
      }

      if (session.menteeId !== menteeId) {
        throw new AppError(
          'You can only review sessions you participated in',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if session is completed
      if (session.status !== 'completed') {
        throw new AppError(
          'You can only review completed sessions',
          StatusCodes.BAD_REQUEST
        );
      }

      // Check if review already exists
      const existingReview = await this.reviewRepository.findOne({
        where: {
          sessionId: data.sessionId,
          menteeId,
        },
      });

      if (existingReview) {
        throw new AppError(
          'You have already reviewed this session',
          StatusCodes.CONFLICT
        );
      }

      // Create review
      const review = this.reviewRepository.create({
        sessionId: data.sessionId,
        mentorId: session.mentorId,
        menteeId,
        rating: data.rating,
        comment: data.comment,
        isVisible: true,
      });

      const savedReview = await this.reviewRepository.save(review);

      logger.info('Review created successfully', {
        reviewId: savedReview.id,
        sessionId: data.sessionId,
        mentorId: session.mentorId,
        menteeId,
        rating: data.rating,
      });

      return savedReview;
    } catch (error: any) {
      logger.error('Error creating review', error);
      throw error;
    }
  }

  /**
   * Get reviews for a mentor
   */
  async getMentorReviews(
    mentorId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    try {
      const queryBuilder = this.reviewRepository
        .createQueryBuilder('review')
        .leftJoinAndSelect('review.mentee', 'mentee')
        .leftJoinAndSelect('review.session', 'session')
        .where('review.mentorId = :mentorId', { mentorId })
        .andWhere('review.isVisible = :isVisible', { isVisible: true })
        .orderBy('review.createdAt', 'DESC');

      const total = await queryBuilder.getCount();

      if (options.limit) {
        queryBuilder.take(options.limit);
      }
      if (options.offset) {
        queryBuilder.skip(options.offset);
      }

      const reviews = await queryBuilder.getMany();

      // Calculate average rating
      const averageRating =
        reviews.length > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length
          : 0;

      return {
        reviews,
        total,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      };
    } catch (error: any) {
      logger.error('Error getting mentor reviews', error);
      throw error;
    }
  }

  /**
   * Get review for a specific session
   */
  async getSessionReview(
    sessionId: string,
    menteeId: string
  ): Promise<Review | null> {
    try {
      const review = await this.reviewRepository.findOne({
        where: {
          sessionId,
          menteeId,
        },
        relations: ['mentee', 'session'],
      });

      return review;
    } catch (error: any) {
      logger.error('Error getting session review', error);
      throw error;
    }
  }

  /**
   * Update review
   */
  async updateReview(
    reviewId: string,
    menteeId: string,
    data: { rating?: number; comment?: string }
  ): Promise<Review> {
    try {
      const review = await this.reviewRepository.findOne({
        where: { id: reviewId, menteeId },
      });

      if (!review) {
        throw new AppError('Review not found', StatusCodes.NOT_FOUND);
      }

      if (data.rating !== undefined) {
        if (data.rating < 1 || data.rating > 5) {
          throw new AppError(
            'Rating must be between 1 and 5',
            StatusCodes.BAD_REQUEST
          );
        }
        review.rating = data.rating;
      }

      if (data.comment !== undefined) {
        review.comment = data.comment;
      }

      const updatedReview = await this.reviewRepository.save(review);

      logger.info('Review updated successfully', {
        reviewId,
        menteeId,
      });

      return updatedReview;
    } catch (error: any) {
      logger.error('Error updating review', error);
      throw error;
    }
  }
}

