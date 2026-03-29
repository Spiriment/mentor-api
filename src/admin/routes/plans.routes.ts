import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminOrgPlanController } from '@/controllers/adminOrgPlan.controller';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import {
  adminOrgPlanCreateBodySchema,
  adminOrgPlanPatchBodySchema,
} from '@/validation/adminPhase4.validation';

const router = Router();

router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

router.get('/church', adminOrgPlanController.listChurch);
router.get('/family', adminOrgPlanController.listFamily);

router.post(
  '/church',
  validate(adminOrgPlanCreateBodySchema, 'body'),
  adminOrgPlanController.createChurch
);
router.post(
  '/family',
  validate(adminOrgPlanCreateBodySchema, 'body'),
  adminOrgPlanController.createFamily
);

router.patch(
  '/church/:id',
  validate(adminOrgPlanPatchBodySchema, 'body'),
  adminOrgPlanController.patchChurch
);
router.patch(
  '/family/:id',
  validate(adminOrgPlanPatchBodySchema, 'body'),
  adminOrgPlanController.patchFamily
);

router.delete('/church/:id', adminOrgPlanController.deleteChurch);
router.delete('/family/:id', adminOrgPlanController.deleteFamily);

export default router;
