import { Router } from 'express';
import { SessionReviewController } from '@/controllers/sessionReview.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const sessionReviewController = new SessionReviewController();

// All routes require authentication
router.use(authenticateToken);

// Create a review (mentee only)
router.post('/', sessionReviewController.createReview);

// Get review by session ID
router.get('/session/:sessionId', sessionReviewController.getReviewBySessionId);

// Get review by ID
router.get('/:reviewId', sessionReviewController.getReviewById);

// Get mentor's average rating (must be before /:reviewId route)
router.get('/mentor/:mentorId/average', sessionReviewController.getMentorAverageRating);

// Get reviews for a mentor
router.get('/mentor/:mentorId', sessionReviewController.getMentorReviews);

// Get reviews by a mentee
router.get('/mentee/:menteeId', sessionReviewController.getMenteeReviews);

// Update a review (mentee only, within 24 hours)
router.patch('/:reviewId', sessionReviewController.updateReview);

// Mark review as viewed by mentor
router.patch('/:reviewId/viewed', sessionReviewController.markAsViewed);

export default router;
