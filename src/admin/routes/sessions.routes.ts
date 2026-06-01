import { Router } from 'express';
import { adminSessionController } from '@/controllers/adminSession.controller';

const router = Router();

router.get('/', adminSessionController.list);
router.get('/:sessionId', adminSessionController.getById);
router.patch('/:sessionId/status', adminSessionController.patchStatus);

export default router;
