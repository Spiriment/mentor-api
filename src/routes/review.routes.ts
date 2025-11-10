import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const reviewController = new ReviewController();
const router = Router();

// All review routes require authentication
router.use(authenticateToken);

// Create a review (mentee only)
router.post('/', reviewController.createReview);

// Get reviews for a mentor (public, but requires auth)
router.get('/mentor/:mentorId', reviewController.getMentorReviews);

// Get review for a specific session (mentee only)
router.get('/session/:sessionId', reviewController.getSessionReview);

// Update review (mentee only)
router.patch('/:reviewId', reviewController.updateReview);

export { router as reviewRoutes };

