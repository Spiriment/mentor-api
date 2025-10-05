import { Queue, Worker, Job } from "bullmq";
import { QueueNames, JobTypes, JobData } from "./types";
import { Logger } from "@/common";
import { EmailWorker, NotificationWorker } from "./workers";
import { RedisClient } from "@/common";

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private logger: Logger;

  private emailWorker: EmailWorker;
  private notificationWorker: NotificationWorker;
  private redis: RedisClient;

  constructor(logger: Logger, redis: RedisClient) {
    this.logger = logger;

    this.emailWorker = new EmailWorker(logger);
    this.notificationWorker = new NotificationWorker(logger);
    this.redis = redis;

    this.initializeQueues();
  }

  private initializeQueues(): void {
    Object.values(QueueNames).forEach((queueName) => {
      const queue = new Queue(queueName, {
        connection: this.redis.getClient,
      });

      this.queues.set(queueName, queue);
      this.logger.info(`Queue ${queueName} initialized`);
    });
  }

  public initializeWorkers(): void {
    this.createWorker(QueueNames.EMAIL, async (job: Job) => {
      await this.emailWorker.processJob(job);
    });

    this.createWorker(QueueNames.NOTIFICATION, async (job: Job) => {
      await this.notificationWorker.processJob(job);
    });
  }

  private createWorker(
    queueName: string,
    processor: (job: Job) => Promise<void>
  ): void {
    const worker = new Worker(queueName, processor, {
      connection: this.redis.getClient,
      concurrency: this.getConcurrencyForQueue(queueName),
    });

    worker.on("completed", (job) => {
      this.logger.info(
        `Job ${job.id} completed successfully in queue ${queueName}`
      );
    });

    worker.on("failed", (job, err) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}:`, err);
    });

    worker.on("error", (error) => {
      this.logger.error(`Worker error in queue ${queueName}:`, error);

      if (
        error.message?.includes("ECONNRESET") ||
        error.message?.includes("Connection")
      ) {
        this.logger.warn(
          `Connection error detected for queue ${queueName}, worker will attempt to reconnect`
        );
      }
    });

    worker.on("stalled", (jobId) => {
      this.logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
    });

    worker.on("active", (job) => {
      this.logger.debug(
        `Job ${job.id} started processing in queue ${queueName}`
      );
    });

    this.workers.set(queueName, worker);
    this.logger.info(`Worker for queue ${queueName} initialized`);
  }

  private getConcurrencyForQueue(queueName: string): number {
    switch (queueName) {
      case QueueNames.EMAIL:
        return 20;
      case QueueNames.NOTIFICATION:
        return 20;

      default:
        return 1;
    }
  }

  public async addEmailJob(data: JobData, options?: object): Promise<void> {
    const queue = this.queues.get(QueueNames.EMAIL);
    if (!queue) throw new Error("Email queue not initialized");

    await queue.add(JobTypes.SEND_EMAIL, data, options);
    this.logger.info("Email job added to queue");
  }

  public async addNotificationJob(
    data: JobData,
    options?: object
  ): Promise<void> {
    const queue = this.queues.get(QueueNames.NOTIFICATION);
    if (!queue) throw new Error("Notification queue not initialized");

    await queue.add(JobTypes.SEND_NOTIFICATION, data, options);
    this.logger.info("Notification job added to queue");
  }

  public getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  public getQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  public async getQueueStats(queueName: string): Promise<any> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.pause();
    this.logger.info(`Queue ${queueName} paused`);
  }

  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.resume();
    this.logger.info(`Queue ${queueName} resumed`);
  }

  public async shutdown(): Promise<void> {
    this.logger.info("Shutting down queue manager...");

    for (const [queueName, worker] of this.workers) {
      await worker.close();
      this.logger.info(`Worker for queue ${queueName} closed`);
    }

    for (const [queueName, queue] of this.queues) {
      await queue.close();
      this.logger.info(`Queue ${queueName} closed`);
    }

    this.logger.info("Queue manager shutdown complete");
  }
}
