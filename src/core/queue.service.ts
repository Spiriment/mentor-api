import { QueueManager, EmailJobData, NotificationJob } from "../queue";
import { logger } from "../config/int-services";

export class QueueService {
  private queueManager: QueueManager;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
  }

  public initialize(): void {
    logger.info("Queue service initialized");
  }

  public async sendEmail(
    emailData: EmailJobData,
    priority: number = 5
  ): Promise<void> {
    const options = priority ? { priority } : undefined;
    await this.queueManager.addEmailJob(emailData, options);
  }

  public async sendDelayedEmail(
    emailData: EmailJobData,
    delayMs: number
  ): Promise<void> {
    const options = { delay: delayMs };
    await this.queueManager.addEmailJob(emailData, options);
  }

  public async sendNotification(
    notificationData: NotificationJob,
    priority?: number
  ): Promise<void> {
    const options = priority ? { priority } : undefined;
    await this.queueManager.addNotificationJob(notificationData, options);
  }

  public async sendBulkNotifications(
    notifications: NotificationJob[]
  ): Promise<void> {
    const promises = notifications.map((notification) =>
      this.queueManager.addNotificationJob(notification)
    );
    await Promise.all(promises);
  }

  public async getQueueStats(queueName: string) {
    return await this.queueManager.getQueueStats(queueName);
  }

  public async getAllQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};
    const queueNames = [
      "email-queue",
      "notification-queue",
      "User-transaction-queue",
      "user-transaction-queue",
      "station-transaction-queue",
      "leaderboard-queue",
    ];

    for (const queueName of queueNames) {
      try {
        stats[queueName] = await this.queueManager.getQueueStats(queueName);
      } catch (error) {
        logger.error(
          `Failed to get stats for queue ${queueName}:`,
          error instanceof Error ? error : new Error(String(error))
        );
        stats[queueName] = { error: "Failed to fetch stats" };
      }
    }

    return stats;
  }

  public async pauseQueue(queueName: string): Promise<void> {
    await this.queueManager.pauseQueue(queueName);
  }

  public async resumeQueue(queueName: string): Promise<void> {
    await this.queueManager.resumeQueue(queueName);
  }

  public async shutdown(): Promise<void> {
    await this.queueManager.shutdown();
  }

  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const stats = await this.getAllQueueStats();
      return {
        status: "healthy",
        details: {
          queues: stats,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Add a generic job to any queue
   */
  public async addJob(
    queueName: string,
    data: any,
    options?: object
  ): Promise<void> {
    const queue = this.queueManager.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.add(queueName, data, options);
  }
}
