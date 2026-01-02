import cron from 'node-cron';
import { notificationSchedulerService } from '../services/notificationScheduler.service';
import { Logger } from '../common';

const logger = new Logger({
  service: 'notification-cron',
  level: process.env.LOG_LEVEL || 'info',
});

/**
 * Process pending notifications every minute
 */
export const startNotificationCron = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await notificationSchedulerService.processPendingNotifications();
    } catch (error) {
      logger.error(
        'Error in notification cron job',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

  logger.info('📅 Notification cron job started (runs every minute)');
};

/**
 * Clean up old notifications once per day at midnight
 */
export const startCleanupCron = () => {
  // Run at midnight every day
  cron.schedule('0 0 * * *', async () => {
    try {
      await notificationSchedulerService.cleanupOldNotifications();
    } catch (error) {
      logger.error(
        'Error in cleanup cron job',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  });

  logger.info('🧹 Cleanup cron job started (runs daily at midnight)');
};
