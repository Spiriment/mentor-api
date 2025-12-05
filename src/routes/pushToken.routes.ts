import { Router } from 'express';
import { pushTokenController } from '../controllers/pushToken.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Save push token
router.post('/', pushTokenController.savePushToken);

// Remove push token (on logout)
router.delete('/', pushTokenController.removePushToken);

export default router;
