import { Router } from 'express';
import { GroupSessionController } from '@/controllers/groupSession.controller';
import { authMiddleware } from '@/middleware/auth.middleware';
import { roleMiddleware } from '@/middleware/role.middleware';
import { USER_ROLE } from '@/common/constants';

const router = Router();
const groupSessionController = new GroupSessionController();

// All routes require authentication
router.use(authMiddleware);

/**
 * Mentor Routes
 */

// Get eligible mentees (mentor only)
router.get(
  '/eligible-mentees',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.getEligibleMentees
);

// Create group session (mentor only)
router.post(
  '/',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.createGroupSession
);

// Get mentor's group sessions (mentor only)
router.get(
  '/mentor/sessions',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.getMentorGroupSessions
);

// Start group session (mentor only)
router.post(
  '/:id/start',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.startGroupSession
);

// End group session (mentor only)
router.post(
  '/:id/end',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.endGroupSession
);

// Update group session (mentor only)
router.put(
  '/:id',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.updateGroupSession
);

// Cancel group session (mentor only)
router.delete(
  '/:id',
  roleMiddleware([USER_ROLE.MENTOR]),
  groupSessionController.cancelGroupSession
);

/**
 * Mentee Routes
 */

// Get mentee's invitations (mentee only)
router.get(
  '/invitations',
  roleMiddleware([USER_ROLE.MENTEE]),
  groupSessionController.getMenteeInvitations
);

// Respond to invitation (mentee only)
router.put(
  '/:id/respond',
  roleMiddleware([USER_ROLE.MENTEE]),
  groupSessionController.respondToInvitation
);

// Submit session summary (mentee only)
router.post(
  '/:id/summary',
  roleMiddleware([USER_ROLE.MENTEE]),
  groupSessionController.submitSessionSummary
);

/**
 * Shared Routes (mentor or mentee)
 */

// Get group session details (mentor or participant)
router.get('/:id', groupSessionController.getGroupSession);

export default router;
