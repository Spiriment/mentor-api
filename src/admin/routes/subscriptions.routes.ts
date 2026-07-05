import { Router } from 'express';
import { adminSubscriptionController } from '@/controllers/adminSubscription.controller';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';

const router = Router();

router.get('/summary', adminSubscriptionController.getSummary);
router.get(
  '/individual',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  adminSubscriptionController.listIndividual,
);

// Promo code management — super admin only
router.post(
  '/promo-codes',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  adminSubscriptionController.createPromoCode,
);
router.get(
  '/promo-codes',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  adminSubscriptionController.listPromoCodes,
);
router.patch(
  '/promo-codes/:id',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  adminSubscriptionController.updatePromoCode,
);

export default router;
