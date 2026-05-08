import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  createFamilyPlan,
  getMyFamilyPlan,
  addFamilyMember,
  removeFamilyMember,
  changeFamilyMemberTier,
} from '@/controllers/familyPlan.controller';

const router = Router();

router.use(authenticateToken);

router.post('/', createFamilyPlan);
router.get('/me', getMyFamilyPlan);
router.post('/:planId/members', addFamilyMember);
router.delete('/:planId/members/:memberId', removeFamilyMember);
router.patch('/:planId/members/:memberId', changeFamilyMemberTier);

export default router;
