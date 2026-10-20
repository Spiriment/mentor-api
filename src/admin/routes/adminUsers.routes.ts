import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminAdminUserController } from '@/controllers/adminAdminUser.controller';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import {
  adminAdminUsersCreateBodySchema,
  adminAdminUsersListQuerySchema,
  adminAdminUsersPatchPermissionsSchema,
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
router.get('/permissions', adminAdminUserController.listPermissions);
router.patch(
  '/:adminUserId/permissions',
  validate(adminAdminUsersPatchPermissionsSchema, 'body'),
  adminAdminUserController.patchPermissions
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
