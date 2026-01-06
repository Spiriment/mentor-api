import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// Dashboard/Broadcast Routes
router.post('/broadcast-push', adminController.broadcastPushNotification);

export default router;
