import { Logger } from "../../common/logger";
import nodemailer from "nodemailer";
import * as path from "path";
import { Config } from "@/common";
import { Job } from "bullmq";

export class EmailWorker {
  private logger: Logger;
  private transporter: nodemailer.Transporter;

  constructor(logger: Logger) {
    this.logger = logger;
    this.transporter = nodemailer.createTransport({
      host: Config.email.host,
      port: Config.email.port,
      secure: Config.email.port === 465,
      auth: {
        user: Config.email.user,
        pass: Config.email.password,
      },
    });
  }

  async processJob(job: Job): Promise<void> {
    this.logger.info(`Processing email job ${job.id}`);

    const { to, subject } = job.data;

    try {
      await this.sendMail(job);

      this.logger.info(`Email job ${job.id} completed successfully`, {
        to,
        subject,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process email job ${job.id}:`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  private async sendMail(job: Job): Promise<void> {
    const { to, subject, compiledContent } = job.data;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: compiledContent,
      attachments: [
        {
          filename: "logo.jpeg",
          path: path.join(__dirname, "../../mails/assets/logo.jpeg"),
          cid: "logo",
        },
      ],
    };

    await this.transporter.sendMail(mailOptions);
  }
}
