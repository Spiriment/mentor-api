import { Router } from 'express';
import { ChurchPortalMembersController } from '../controllers/churchPortalMembers.controller';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';

export function createChurchPortalMembersRoutes(controller: ChurchPortalMembersController): Router {
  const router = Router();

  router.use(churchPortalAuthMiddleware);

  router.get('/', controller.listMembers);
  router.get('/join-requests', controller.listJoinRequests);
  router.post('/join-requests/:userId/approve', controller.approveJoinRequest);
  router.post('/join-requests/:userId/reject', controller.rejectJoinRequest);
  router.get('/:userId', controller.getMember);
  router.get('/:userId/sessions', controller.getMemberSessions);
  router.get('/:userId/streak', controller.getMemberStreak);
  router.delete('/:userId', controller.removeMember);

  return router;
}
