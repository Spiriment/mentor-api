import { Router } from 'express';
import { MentorController } from '../controllers/mentor.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '../common/middleware/validation';
import { updateMentorProfileSchema } from '../validation/mentor.validation';
import {
  uploadProfileImage,
  handleUploadError,
} from '../middleware/upload.middleware';

const router = Router();
const mentorController = new MentorController();

// All mentor routes require authentication and mentor role
router.use(authenticateToken);
router.use(requireRole(['mentor']));

// Mentor dashboard
router.get('/dashboard', mentorController.getDashboard);

// Mentees management
router.get('/mentees', mentorController.getMentees);
router.get('/mentees/:menteeId', mentorController.getMenteeDetails);

// Profile management
router.put(
  '/profile',
  validate(updateMentorProfileSchema),
  mentorController.updateProfile
);

router.put(
  '/profile/photo',
  uploadProfileImage,
  handleUploadError,
  mentorController.updateProfilePhoto
);

export { router as mentorRoutes };

