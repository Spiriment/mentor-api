import { Router } from 'express';
import { SessionController } from '../controllers/session.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validate } from '@/common/middleware/validation';
import {
  createSessionSchema,
  updateSessionSchema,
  cancelSessionSchema,
  createAvailabilitySchema,
  updateSessionStatusSchema,
  sessionQuerySchema,
  dateParamSchema,
} from '@/validation/session.validation';

const sessionController = new SessionController();
const router = Router();

// All session routes require authentication
router.use(authenticateToken);

// Session CRUD operations
router.post(
  '/',
  requireRole(['mentee']),
  validate(createSessionSchema),
  sessionController.createSession
);

router.get(
  '/',
  validate(sessionQuerySchema),
  sessionController.getUserSessions
);

router.get('/:sessionId', sessionController.getSessionById);

router.put(
  '/:sessionId',
  validate(updateSessionSchema),
  sessionController.updateSession
);

router.delete(
  '/:sessionId',
  validate(cancelSessionSchema),
  sessionController.cancelSession
);

// Session status management
router.patch(
  '/:sessionId/status',
  validate(updateSessionStatusSchema),
  sessionController.updateSessionStatus
);

// Availability management
router.post(
  '/availability',
  requireRole(['mentor']),
  validate(createAvailabilitySchema),
  sessionController.createAvailability
);

router.get(
  '/mentor/:mentorId/availability',
  sessionController.getMentorAvailability
);

router.get(
  '/mentor/:mentorId/availability/:date',
  validate(dateParamSchema),
  sessionController.getAvailableSlots
);

export { router as sessionRoutes };
