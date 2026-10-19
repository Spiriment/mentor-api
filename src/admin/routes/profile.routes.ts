import { Router } from 'express';
import { validate } from '@/common';
import { adminProfileController } from '@/controllers/adminProfile.controller';
import { adminAlertsController } from '@/controllers/adminAlerts.controller';
import { adminProfilePatchBodySchema } from '@/validation/adminProfile.validation';

const router = Router();

router.get('/', adminProfileController.getMe);
router.patch(
  '/',
  validate(adminProfilePatchBodySchema, 'body'),
  adminProfileController.patchMe
);

// Per-admin notification preferences + browser (web push) registration
router.get('/notification-preferences', adminAlertsController.getPreferences);
router.put('/notification-preferences', adminAlertsController.putPreferences);
router.post('/push-subscriptions', adminAlertsController.subscribePush);
router.delete('/push-subscriptions', adminAlertsController.unsubscribePush);
router.post('/push-test', adminAlertsController.testPush);

export default router;
