import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const notificationController = new NotificationController();
const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

// Get user's notifications
router.get('/', notificationController.getUserNotifications);

// Mark notification as read
router.patch('/:notificationId/read', notificationController.markAsRead);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// Delete notification
router.delete('/:notificationId', notificationController.deleteNotification);

export { router as notificationRoutes };

