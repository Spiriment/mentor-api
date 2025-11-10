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
  rescheduleSessionSchema,
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
  validate(sessionQuerySchema, 'query'),
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

// Reschedule session (mentor only)
router.patch(
  '/:sessionId/reschedule',
  requireRole(['mentor']),
  validate(rescheduleSessionSchema),
  sessionController.rescheduleSession
);

// Confirm session attendance
router.patch(
  '/:sessionId/confirm',
  sessionController.confirmSession
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
  validate(dateParamSchema, 'params'),
  sessionController.getAvailableSlots
);

// Session notes and summaries
router.patch(
  '/:sessionId/notes',
  sessionController.addSessionNotes
);

export { router as sessionRoutes };
