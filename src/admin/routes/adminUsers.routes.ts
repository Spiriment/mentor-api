import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminAdminUserController } from '@/controllers/adminAdminUser.controller';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import {
  adminAdminUsersCreateBodySchema,
  adminAdminUsersListQuerySchema,
  adminAdminUsersPatchStatusSchema,
  adminAdminUsersResetPasswordSchema,
} from '@/validation/adminAdminUsers.validation';

const router = Router();

router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

router.get(
  '/',
  validate(adminAdminUsersListQuerySchema, 'query'),
  adminAdminUserController.list
);
router.post(
  '/',
  validate(adminAdminUsersCreateBodySchema, 'body'),
  adminAdminUserController.post
);
router.patch(
  '/:adminUserId/status',
  validate(adminAdminUsersPatchStatusSchema, 'body'),
  adminAdminUserController.patchStatus
);
router.post(
  '/:adminUserId/reset-password',
  validate(adminAdminUsersResetPasswordSchema, 'body'),
  adminAdminUserController.resetPassword
);

export default router;
