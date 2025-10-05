import { Attachment } from "nodemailer/lib/mailer";

export interface EmailJobData {
  to: string;
  subject: string;
  compiledContent?: string;
  attachments?: Attachment[];
}
export interface NotificationJob {
  pushNotificationId: string;
  email: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
}

export type JobData = EmailJobData | NotificationJob;

export enum QueueNames {
  EMAIL = "email_queue",
  NOTIFICATION = "notification_queue",
}

export enum JobTypes {
  SEND_EMAIL = "send-email",
  SEND_NOTIFICATION = "send-notification",
}

export interface LeaderboardJob {
  userId: string;
  type: "UPDATE_User_STATS" | "UPDATE_ALL_LEADERBOARD_POSITIONS";
}
