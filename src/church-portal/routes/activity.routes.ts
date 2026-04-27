import { Router } from 'express';
import { ChurchPortalActivityController } from '../controllers/churchPortalActivity.controller';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';

export function createChurchPortalActivityRoutes(controller: ChurchPortalActivityController): Router {
  const router = Router();

  router.use(churchPortalAuthMiddleware);

  router.get('/mentors', controller.getMentors);
  router.get('/mentees', controller.getMentees);
  router.get('/sessions', controller.getSessions);
  router.get('/bible-reading', controller.getBibleReading);

  return router;
}
