import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';
import { ChurchPortalTeamController, requirePastor } from '../controllers/churchPortalTeam.controller';

// Each of these sends an email from Spiriment to an address the caller typed
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many invites. Try again later.' },
});

export function createChurchPortalTeamRoutes(controller: ChurchPortalTeamController): Router {
  const router = Router();

  router.use(churchPortalAuthMiddleware, requirePastor);

  router.get('/', controller.list);
  router.post('/', inviteLimiter, controller.invite);
  router.post('/:userId/resend', inviteLimiter, controller.resend);
  router.delete('/:userId/invite', controller.cancelInvite);
  router.patch('/:userId', controller.update);

  return router;
}
