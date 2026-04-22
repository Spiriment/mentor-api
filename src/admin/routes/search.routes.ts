import { Router } from 'express';
import { adminSearchController } from '@/controllers/adminSearch.controller';

const router = Router();

router.get('/global', adminSearchController.globalSearch);

export default router;
