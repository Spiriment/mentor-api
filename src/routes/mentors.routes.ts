import { Router } from 'express';
import { MentorsController } from '../controllers/mentors.controller';

const router = Router();
const mentorsController = new MentorsController();

// Get all approved mentors (for mentees to browse)
router.get('/', mentorsController.getApprovedMentors);

// Get recommended mentors for HomeScreen
router.get('/recommended', mentorsController.getRecommendedMentors);

// Get mentors by specific criteria
router.get('/search', mentorsController.getMentorsByCriteria);

// Get a specific mentor's full profile
router.get('/:mentorId', mentorsController.getMentorProfile);

export { router as mentorsRoutes };
