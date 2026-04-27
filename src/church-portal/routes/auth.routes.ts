import { Router } from 'express';
import { ChurchPortalAuthController } from '../controllers/churchPortalAuth.controller';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';

export function createChurchPortalAuthRoutes(controller: ChurchPortalAuthController): Router {
  const router = Router();

  // Public routes
  router.post('/login', controller.login);
  router.post('/logout', controller.logout);
  router.post('/refresh', controller.refreshToken);
  router.post('/accept-invite', controller.acceptInvite);
  router.post('/forgot-password', controller.forgotPassword);
  router.post('/reset-password', controller.resetPassword);

  // Protected routes
  router.get('/me', churchPortalAuthMiddleware, controller.getMe);
  router.patch('/me', churchPortalAuthMiddleware, controller.updateMe);

  return router;
}
