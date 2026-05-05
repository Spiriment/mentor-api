import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getMySubscription,
  createCheckout,
  getBillingPortal,
  cancelSubscription,
  redeemPromoCode,
} from '@/controllers/subscription.controller';

const router = Router();

router.use(authenticateToken);

router.get('/me', getMySubscription);
router.post('/checkout', createCheckout);
router.post('/portal', getBillingPortal);
router.post('/cancel', cancelSubscription);
router.post('/redeem', redeemPromoCode);

export default router;
