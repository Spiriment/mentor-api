import { Router } from 'express';
import { ChurchPortalAuthController } from '../controllers/churchPortalAuth.controller';

export function createChurchPortalPortalRoutes(controller: ChurchPortalAuthController): Router {
  const router = Router();

  // Public — used by login page to brand itself per church
  router.get('/info', controller.getPortalInfo);

  return router;
}
