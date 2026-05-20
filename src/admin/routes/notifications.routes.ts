import { Router } from 'express';
import { adminNotificationsController } from '@/controllers/adminNotifications.controller';

const router = Router();

router.get('/summary', adminNotificationsController.getSummary);
router.patch('/contacts/read-all', adminNotificationsController.markAllContactsRead);
router.patch('/contacts/:id/read', adminNotificationsController.markContactRead);

export default router;
