import { Router } from 'express';
import { ChurchPortalMembersController } from '../controllers/churchPortalMembers.controller';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';

export function createChurchPortalMembersRoutes(controller: ChurchPortalMembersController): Router {
  const router = Router();

  router.use(churchPortalAuthMiddleware);

  router.get('/', controller.listMembers);
  router.get('/:userId', controller.getMember);
  router.get('/:userId/sessions', controller.getMemberSessions);
  router.get('/:userId/streak', controller.getMemberStreak);

  return router;
}
