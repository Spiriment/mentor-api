import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getMySubscription,
  createCheckout,
  getBillingPortal,
  cancelSubscription,
  redeemPromoCode,
  acknowledgeTrialExpired,
  syncAppleIAP,
} from '@/controllers/subscription.controller';

const router = Router();

router.use(authenticateToken);

router.get('/me', getMySubscription);
router.post('/checkout', createCheckout);
router.post('/portal', getBillingPortal);
router.post('/cancel', cancelSubscription);
router.post('/redeem', redeemPromoCode);
router.post('/acknowledge-trial-expired', acknowledgeTrialExpired);
router.post('/apple-iap/sync', syncAppleIAP);

export default router;
