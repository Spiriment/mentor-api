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

// Church org plans (OrgPlan entity, planType = church)
router.get('/church', adminOrgPlanController.listChurch);
router.get('/church/:id', adminOrgPlanController.getChurch);
router.post(
  '/church',
  validate(adminOrgPlanCreateBodySchema, 'body'),
  adminOrgPlanController.createChurch
);
router.patch(
  '/church/:id',
  validate(adminOrgPlanPatchBodySchema, 'body'),
  adminOrgPlanController.patchChurch
);
router.delete('/church/:id', adminOrgPlanController.deleteChurch);

router.get('/:id/members', adminOrgPlanController.getMembers);
router.get('/:id/report', adminOrgPlanController.getReport);
router.post('/:id/members', adminOrgPlanController.assignMember);
router.delete('/:id/members', adminOrgPlanController.removeMember);

// Family plans (FamilyPlan entity — not org_plans)
router.get('/family-plans', adminOrgPlanController.listFamilyPlans);
router.get('/family-plans/:id', adminOrgPlanController.getFamilyPlan);
router.delete('/family-plans/:id', adminOrgPlanController.adminDeactivateFamilyPlan);
router.delete('/family-plans/:id/members', adminOrgPlanController.adminRemoveFamilyMember);
router.patch('/family-plans/:id/members', adminOrgPlanController.adminChangeFamilyMemberTier);

export default router;
