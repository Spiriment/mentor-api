import { Router } from 'express';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import { demoVisitorController } from '@/controllers/demoVisitor.controller';

/** People who tried the church portal demo — super admin only. Base path: /api/admin/demo-visitors */
const router = Router();
router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));
router.get('/', demoVisitorController.list);
router.delete('/:id', demoVisitorController.remove);
export default router;
