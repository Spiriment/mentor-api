import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminUserController } from '@/controllers/adminUser.controller';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import {
  adminUserListQuerySchema,
  adminUserDiscountBodySchema,
} from '@/validation/adminUsers.validation';
import { adminUserSubscriptionPutSchema } from '@/validation/adminPhase4.validation';

const router = Router();

router.get(
  '/',
  validate(adminUserListQuerySchema, 'query'),
  adminUserController.list
);
router.get('/:userId', adminUserController.getById);
router.post(
  '/:userId/discounts',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  validate(adminUserDiscountBodySchema, 'body'),
  adminUserController.postDiscount
);
router.delete(
  '/:userId/discounts/:discountId',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  adminUserController.deleteDiscount
);
router.put(
  '/:userId/subscription',
  requireAdminRole(ADMIN_ROLE.SUPER_ADMIN),
  validate(adminUserSubscriptionPutSchema, 'body'),
  adminUserController.putSubscription
);

export default router;
