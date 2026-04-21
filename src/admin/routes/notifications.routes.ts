import { Router } from 'express';
import { adminNotificationsController } from '@/controllers/adminNotifications.controller';

const router = Router();

router.get('/summary', adminNotificationsController.getSummary);

export default router;
