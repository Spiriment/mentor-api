import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminSpirimentSettingsController } from '@/controllers/adminSpirimentSettings.controller';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import {
  adminAppUpdateNotifyBodySchema,
  adminSpirimentSettingsPatchSchema,
} from '@/validation/adminPhase4.validation';

const router = Router();

router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

router.get('/', adminSpirimentSettingsController.get);
router.patch(
  '/',
  validate(adminSpirimentSettingsPatchSchema, 'body'),
  adminSpirimentSettingsController.patch
);

router.post(
  '/app-release/notify',
  validate(adminAppUpdateNotifyBodySchema, 'body'),
  adminSpirimentSettingsController.notifyAppUpdate
);

export default router;
