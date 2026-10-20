import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { churchPortalAuthMiddleware } from '../middleware/churchPortalAuth.middleware';
import { ChurchPortalBillingController } from '../controllers/churchPortalBilling.controller';
import { churchPortalBillingHandlers } from '@/controllers/churchBilling.controller';

const invoiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many invoice requests. Try again later.' },
});

export function createChurchPortalBillingRoutes(
  controller: ChurchPortalBillingController,
): Router {
  const router = Router();
  router.use(churchPortalAuthMiddleware);
  router.get('/preview', controller.getPreview);
  router.post('/invoice', invoiceLimiter, controller.generateInvoice);

  // Who the church pays for (changes: pastor role only)
  router.get('/coverage', churchPortalBillingHandlers.overview);
  router.post('/coverage/:userId', churchPortalBillingHandlers.cover);
  router.patch('/coverage/:userId', churchPortalBillingHandlers.changeTier);
  router.delete('/coverage/:userId', churchPortalBillingHandlers.uncover);
  router.patch('/settings', churchPortalBillingHandlers.updateSettings);
  return router;
}
