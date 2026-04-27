import { Router } from 'express';
import { ChurchPortalDashboardController } from '../controllers/churchPortalDashboard.controller';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';

export function createChurchPortalDashboardRoutes(controller: ChurchPortalDashboardController): Router {
  const router = Router();

  router.use(churchPortalAuthMiddleware);

  router.get('/summary', controller.getSummary);
  router.get('/activity', controller.getActivityFeed);

  return router;
}
