import * as cron from "node-cron";
import { DataSource } from "typeorm";
import { logger, redis } from "@/config/int-services";
import { RedisClient } from "@/common";

export class CronService {
  private dataSource: DataSource;
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Initialize and start all cron jobs
   */
  startAllCronJobs(): void {
    logger.info("Starting all cron jobs...");
    logger.info(`Started ${this.tasks.size} cron jobs`);
  }

  /**
   * Stop all cron jobs
   */
  stopAllCronJobs(): void {
    logger.info("Stopping all cron jobs...");

    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`Stopped cron job: ${name}`);
    }

    this.tasks.clear();
    logger.info("All cron jobs stopped");
  }

  /**
   * Get status of all cron jobs
   */
  getCronJobsStatus(): Record<
    string,
    { running: boolean; name: string; schedule: string }
  > {
    const status: Record<
      string,
      { running: boolean; name: string; schedule: string }
    > = {};

    for (const [name, task] of this.tasks) {
      status[name] = {
        running: task.getStatus() === "scheduled",
        name,
        schedule: this.getScheduleForTask(name),
      };
    }

    return status;
  }

  /**
   * Get schedule for a specific task
   */
  private getScheduleForTask(taskName: string): string {
    switch (taskName) {
      case "leaderboard-update":
        return "0 * * * * (Every hour)";
      default:
        return "Unknown";
    }
  }

  /**
   * Start a specific cron job
   */
  startCronJob(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      logger.error(`Cron job not found: ${name}`);
      return false;
    }

    try {
      task.start();
      logger.info(`Started cron job: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to start cron job ${name}:`, error as Error);
      return false;
    }
  }

  /**
   * Stop a specific cron job
   */
  stopCronJob(name: string): boolean {
    const task = this.tasks.get(name);
    if (!task) {
      logger.error(`Cron job not found: ${name}`);
      return false;
    }

    try {
      task.stop();
      logger.info(`Stopped cron job: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop cron job ${name}:`, error as Error);
      return false;
    }
  }

  /**
   * Get the number of registered cron jobs
   */
  getCronJobsCount(): number {
    return this.tasks.size;
  }

  /**
   * Check if any cron jobs are running
   */
  hasRunningCronJobs(): boolean {
    for (const task of this.tasks.values()) {
      if (task.getStatus() === "scheduled") {
        return true;
      }
    }
    return false;
  }

  /**
   * Force run a specific task
   */
  async forceRunTask(taskName: string): Promise<boolean> {
    try {
      switch (taskName) {
        default:
          logger.error(`Unknown task: ${taskName}`);
          return false;
      }

      logger.info(`Force run completed for task: ${taskName}`);
      return true;
    } catch (error) {
      logger.error(`Error force running task ${taskName}:`, error as Error);
      return false;
    }
  }
}
