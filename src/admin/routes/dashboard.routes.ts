import { Router } from 'express';
import { adminDashboardController } from '@/controllers/adminDashboard.controller';

const router = Router();

router.get('/summary', adminDashboardController.getSummary);
router.get('/analytics', adminDashboardController.getAnalytics);

export default router;
