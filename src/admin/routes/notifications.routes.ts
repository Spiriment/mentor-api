import { Router } from 'express';
import { adminAlertsController } from '@/controllers/adminAlerts.controller';
import { adminNotificationsController } from '@/controllers/adminNotifications.controller';

const router = Router();

router.get('/summary', adminNotificationsController.getSummary);
router.patch('/contacts/read-all', adminNotificationsController.markAllContactsRead);
router.patch('/contacts/:id/read', adminNotificationsController.markContactRead);
router.patch('/alerts/read-all', adminAlertsController.markAllRead);
router.patch('/alerts/:id/read', adminAlertsController.markRead);

export default router;
