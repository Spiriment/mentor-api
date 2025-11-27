import express from 'express';
import { AppNotificationController } from '../controllers/appNotification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();
const controller = new AppNotificationController();

// All notification routes require authentication
router.use(authenticateToken);

// GET /api/notifications - Get user's notifications
router.get('/', controller.getNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', controller.getUnreadCount);

// PATCH /api/notifications/read-all - Mark all notifications as read
router.patch('/read-all', controller.markAllAsRead);

// PATCH /api/notifications/:notificationId/read - Mark notification as read
router.patch('/:notificationId/read', controller.markAsRead);

// DELETE /api/notifications/:notificationId - Delete notification
router.delete('/:notificationId', controller.deleteNotification);

export default router;
