import { Router } from 'express';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';
import { ChurchPortalHistoryController } from '../controllers/churchPortalHistory.controller';
import { requirePastor } from '../controllers/churchPortalTeam.controller';

/** Read-only for people, apart from reporting an export: entries can't be edited or deleted */
export function createChurchPortalHistoryRoutes(controller: ChurchPortalHistoryController): Router {
  const router = Router();
  router.use(churchPortalAuthMiddleware, requirePastor);
  router.get('/', controller.list);
  router.post('/exports', controller.recordExport);
  return router;
}
