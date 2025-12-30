import { Router } from 'express';
import { GroupSessionController } from '@/controllers/groupSession.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { USER_ROLE } from '@/common/constants';

const router = Router();
const groupSessionController = new GroupSessionController();

// All routes require authentication
router.use(authenticateToken);

/**
 * Mentor Routes
 */

// Get eligible mentees (mentor only)
router.get(
  '/eligible-mentees',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.getEligibleMentees
);

// Create group session (mentor only)
router.post(
  '/',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.createGroupSession
);

// Get mentor's group sessions (mentor only)
router.get(
  '/mentor/sessions',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.getMentorGroupSessions
);

// Start group session (mentor only)
router.post(
  '/:id/start',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.startGroupSession
);

// End group session (mentor only)
router.post(
  '/:id/end',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.endGroupSession
);

// Update group session (mentor only)
router.put(
  '/:id',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.updateGroupSession
);

// Cancel group session (mentor only)
router.delete(
  '/:id',
  requireRole([USER_ROLE.MENTOR]),
  groupSessionController.cancelGroupSession
);

/**
 * Mentee Routes
 */

// Get mentee's invitations (mentee only)
router.get(
  '/invitations',
  requireRole([USER_ROLE.MENTEE]),
  groupSessionController.getMenteeInvitations
);

// Respond to invitation (mentee only)
router.put(
  '/:id/respond',
  requireRole([USER_ROLE.MENTEE]),
  groupSessionController.respondToInvitation
);

// Submit session summary (mentee only)
router.post(
  '/:id/summary',
  requireRole([USER_ROLE.MENTEE]),
  groupSessionController.submitSessionSummary
);

/**
 * Shared Routes (mentor or mentee)
 */

// Get group session details (mentor or participant)
router.get('/:id', groupSessionController.getGroupSession);

export default router;
