import * as cron from "node-cron";
import { DataSource } from "typeorm";
import { logger, redis } from "@/config/int-services";
import { RedisClient } from "@/common";
import { SessionReminderService } from "@/services/sessionReminder.service";
import { StreakNotificationService } from "@/services/streakNotification.service";
import { ReengagementService } from "@/services/reengagement.service";
import { notificationSchedulerService } from "@/services/notificationScheduler.service";
import { MonthlySummaryService } from "@/services/monthlySummary.service";
import { sessionAutoUpdateService } from "@/services/sessionAutoUpdate.service";
import { EmailService } from "./email.service";
import { subMonths } from "date-fns";

export class CronService {
  private dataSource: DataSource;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private sessionReminderService: SessionReminderService | null = null;
  private streakNotificationService: StreakNotificationService | null = null;
  private reengagementService: ReengagementService | null = null;
  private monthlySummaryService: MonthlySummaryService | null = null;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Initialize and start all cron jobs
   */
  startAllCronJobs(): void {
    logger.info("Starting all cron jobs...");

    // Initialize email service and session reminder service
    try {
      // Pass null for queueService - EmailService will send emails directly
      const emailService = new EmailService(null);
      this.sessionReminderService = new SessionReminderService(emailService);

      // Schedule session reminder job - runs every minute
      // This checks for sessions starting in 1 hour and 15 minutes
      const sessionReminderTask = cron.schedule(
        "* * * * *", // Every minute
        async () => {
          // Run 1-hour reminders
          try {
            await this.sessionReminderService?.send1HourReminders();
          } catch (error) {
            logger.error(
              "Error in 1-hour session reminder cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }

          // Run 24-hour reminders
          try {
            await this.sessionReminderService?.send24HourReminders();
          } catch (error) {
            logger.error(
              "Error in 24-hour session reminder cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }

          // Run 15-minute reminders
          try {
            await this.sessionReminderService?.send15MinuteReminders();
          } catch (error) {
            logger.error(
              "Error in 15-minute session reminder cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }

          // Run "Starting Now" reminders
          try {
            await this.sessionReminderService?.sendStartReminders();
          } catch (error) {
            logger.error(
              'Error in "Starting Now" session reminder cron job:',
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          timezone: "UTC",
        }
      );

      this.tasks.set("session-15min-reminder", sessionReminderTask);
      logger.info("Session 15-minute reminder cron job scheduled");

      // Initialize streak notification service
      this.streakNotificationService = new StreakNotificationService();

      // Schedule streak reminder job - runs twice daily at 8 PM user time (approximately)
      // We run at 12:00 PM UTC and 8:00 PM UTC to cover most timezones
      const streakReminderTask = cron.schedule(
        "0 12,20 * * *", // At 12:00 PM and 8:00 PM UTC daily
        async () => {
          try {
            await this.streakNotificationService?.sendStreakReminders();
          } catch (error) {
            logger.error(
              "Error in streak reminder cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          timezone: "UTC",
        }
      );

      this.tasks.set("streak-reminder", streakReminderTask);
      logger.info("Streak reminder cron job scheduled (twice daily)");

      // Initialize re-engagement service
      this.reengagementService = new ReengagementService(emailService);

      // Schedule re-engagement job - runs once daily at 10:00 AM UTC
      const reengagementTask = cron.schedule(
        "0 10 * * *", // At 10:00 AM UTC daily
        async () => {
          try {
            await this.reengagementService?.sendReengagementNotifications();
          } catch (error) {
            logger.error(
              "Error in re-engagement cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          timezone: "UTC",
        }
      );

      this.tasks.set("reengagement", reengagementTask);
      logger.info("Re-engagement cron job scheduled (daily at 10 AM UTC)");

      // Schedule notification processing job - runs every minute
      const notificationProcessingTask = cron.schedule(
        "* * * * *", // Every minute
        async () => {
          try {
            await notificationSchedulerService.processPendingNotifications();
          } catch (error) {
            logger.error(
              "Error in notification processing cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          timezone: "UTC",
        }
      );

      this.tasks.set("notification-processing", notificationProcessingTask);
      logger.info("Notification processing cron job scheduled (every minute)");

      // Initialize monthly summary service
      this.monthlySummaryService = new MonthlySummaryService();

      // Schedule monthly report job - runs at 00:00 on the 1st of every month
      const monthlyReportTask = cron.schedule(
        "0 0 1 * *",
        async () => {
          try {
            const previousMonthDate = subMonths(new Date(), 1);
            const year = previousMonthDate.getFullYear();
            const month = previousMonthDate.getMonth() + 1;
            
            await this.monthlySummaryService?.processMonthlyReportsForAllUsers(emailService, year, month);
          } catch (error) {
            logger.error(
              "Error in monthly report cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          timezone: "UTC",
        }
      );

      this.tasks.set("monthly-report", monthlyReportTask);
      logger.info("Monthly report cron job scheduled (1st of month at 00:00 UTC)");

      // Schedule missed session check job - runs every 30 minutes
      const missedSessionCheckTask = cron.schedule(
        "*/30 * * * *",
        async () => {
          try {
            await sessionAutoUpdateService.checkMissedSessions();
          } catch (error) {
            logger.error(
              "Error in missed session check cron job:",
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          timezone: "UTC",
        }
      );

      this.tasks.set("missed-session-check", missedSessionCheckTask);
      logger.info("Missed session check cron job scheduled (every 30 minutes)");

    } catch (error) {
      logger.error(
        "Error initializing cron jobs:",
        error instanceof Error ? error : new Error(String(error))
      );
    }

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
      case "session-15min-reminder":
        return "* * * * * (Every minute)";
      case "streak-reminder":
        return "0 12,20 * * * (Twice daily at 12 PM and 8 PM UTC)";
      case "reengagement":
        return "0 10 * * * (Daily at 10 AM UTC)";
      case "notification-processing":
        return "* * * * * (Every minute)";
      case "monthly-report":
        return "0 0 1 * * (1st of every month at 00:00 UTC)";
      case "missed-session-check":
        return "*/30 * * * * (Every 30 minutes)";
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
        case "session-15min-reminder":
          if (this.sessionReminderService) {
            await this.sessionReminderService.send15MinuteReminders();
            logger.info(`Force run completed for task: ${taskName}`);
            return true;
          } else {
            logger.error(`Session reminder service not initialized`);
            return false;
          }
        case "streak-reminder":
          if (this.streakNotificationService) {
            await this.streakNotificationService.sendStreakReminders();
            logger.info(`Force run completed for task: ${taskName}`);
            return true;
          } else {
            logger.error(`Streak notification service not initialized`);
            return false;
          }
        case "reengagement":
          if (this.reengagementService) {
            await this.reengagementService.sendReengagementNotifications();
            logger.info(`Force run completed for task: ${taskName}`);
            return true;
          } else {
            logger.error(`Re-engagement service not initialized`);
            return false;
          }
        default:
          logger.error(`Unknown task: ${taskName}`);
          return false;
      }
    } catch (error) {
      logger.error(`Error force running task ${taskName}:`, error as Error);
      return false;
    }
  }
}
