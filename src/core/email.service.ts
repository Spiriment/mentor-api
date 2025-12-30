import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { Logger } from '../common';
import { Config } from '../common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { DynamicEmailOptions } from '../common/types/email.types';
import { QueueService } from './queue.service';
import { EmailJobData } from '../queue/types';

dotenv.config();

export class EmailService {
  private transporter: nodemailer.Transporter;
  private logger: Logger;
  private baseLayout: string;
  private baseTemplate: handlebars.TemplateDelegate;
  private dynamicTemplate: handlebars.TemplateDelegate;
  private queueService: QueueService | null;

  constructor(queueService: QueueService | null) {
    this.queueService = queueService;

    // Initialize logger first for error logging
    this.logger = new Logger({
      service: 'email-service',
      level: process.env.LOG_LEVEL || 'info',
    });

    // Validate email configuration
    if (
      !Config.email.host ||
      Config.email.host.trim() === '' ||
      Config.email.host === 'mail'
    ) {
      const errorMsg = `Invalid SMTP_HOST configuration. Current value: "${
        Config.email.host || 'undefined'
      }". Please set SMTP_HOST in your .env file to a valid SMTP server (e.g., smtp.gmail.com, smtp.mailtrap.io, mail.yourdomain.com)`;
      this.logger.error(
        'Email service configuration error',
        new Error(errorMsg)
      );
      throw new Error(errorMsg);
    }

    if (!Config.email.user || !Config.email.password) {
      const errorMsg =
        'SMTP_USER and SMTP_PASSWORD must be configured in .env file';
      this.logger.error(
        'Email service configuration error',
        new Error(errorMsg)
      );
      throw new Error(errorMsg);
    }

    this.transporter = nodemailer.createTransport({
      host: Config.email.host,
      port: Config.email.port || 587,
      secure: Config.email.port === 465,
      auth: {
        user: Config.email.user,
        pass: Config.email.password,
      },
      tls: {
        // Disable certificate validation for shared hosting with mismatched certificates
        // This is safe when connecting to your own mail server
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000, // 10 seconds connection timeout
      greetingTimeout: 10000, // 10 seconds greeting timeout
      socketTimeout: 10000, // 10 seconds socket timeout
    });

    this.logger.info('Email service initialized successfully', {
      host: Config.email.host,
      port: Config.email.port || 587,
      from: Config.email.from,
      user: Config.email.user?.substring(0, 3) + '***', // Log partial email for security
    });

    this.baseLayout = fs.readFileSync(
      path.join(__dirname, '../mails/partials/baseLayout.hbs'),
      'utf-8'
    );
    this.baseTemplate = handlebars.compile(this.baseLayout);

    const dynamicTemplatePath = path.join(
      __dirname,
      '../mails/partials/dynamic-template.hbs'
    );
    const dynamicTemplateContent = fs.readFileSync(
      dynamicTemplatePath,
      'utf-8'
    );
    this.dynamicTemplate = handlebars.compile(dynamicTemplateContent);

    this.loadPartials();
    this.registerHelpers();
  }

  private registerHelpers(): void {
    handlebars.registerHelper('eq', function (a, b) {
      return a === b;
    });
  }

  private loadPartials(): void {
    const partialsDir = path.join(__dirname, '../mails/partials');

    if (!fs.existsSync(partialsDir)) {
      this.logger.warn(`Partials directory not found: ${partialsDir}`);
      return;
    }

    const filenames = fs.readdirSync(partialsDir);

    filenames.forEach((filename: string) => {
      const matches = /^([^.]+)\.hbs$/.exec(filename);
      if (!matches) {
        return;
      }
      const name = matches[1];
      const filepath = path.join(partialsDir, filename);
      const template = fs.readFileSync(filepath, 'utf8');

      handlebars.registerPartial(name, handlebars.compile(template));
    });

    this.logger.info(`Loaded ${filenames.length} handlebars partials`);
  }

  public async sendEmail(options: EmailJobData): Promise<void> {
    // Attach logo if not already attached
    const logoPath = path.join(__dirname, '../mails/assets/logo.png');
    const attachments = options.attachments || [];

    // Add logo as attachment if it exists and not already included
    if (fs.existsSync(logoPath)) {
      const hasLogo = attachments.some(
        (att: any) => att.filename === 'logo.png' || att.cid === 'logo'
      );
      if (!hasLogo) {
        attachments.push({
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo', // Content ID for embedding in HTML
        });
      }
    }

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.compiledContent,
      attachments,
    };

    this.logger.info('📤 Attempting to send email', {
      to: options.to,
      subject: options.subject,
      from: mailOptions.from,
      hasAttachments: (mailOptions.attachments?.length || 0) > 0,
      timestamp: new Date().toISOString(),
    });

    try {
    await this.transporter.sendMail(mailOptions);

    this.logger.info('✅ Email sent successfully', {
      to: options.to,
      subject: options.subject,
      timestamp: new Date().toISOString(),
    });
    } catch (error: any) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('❌ Failed to send email', errorObj, {
        to: options.to,
        subject: options.subject,
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      });
      throw error; // Re-throw to let caller handle
    }
  }

  public generateEmailContent(data: any, partialName: string): string {
    const partial = handlebars.partials[partialName];
    if (!partial) {
      throw new Error(`Partial ${partialName} not found`);
    }
    const bodyContent = partial(data);
    
    // Check if the template is standalone HTML (starts with <!DOCTYPE html>)
    // If so, return it directly without wrapping in baseLayout
    if (bodyContent.trim().startsWith('<!DOCTYPE html>') || bodyContent.trim().startsWith('<!doctype html>')) {
      return bodyContent;
    }
    
    // Otherwise, wrap in baseLayout
    return this.baseTemplate({
      ...data,
      body: bodyContent,
      currentYear: new Date().getFullYear(),
    });
  }

  public async sendNotificationEmail(props: {
    to: string;
    subject: string;
    message: string;
    userName?: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<void> {
    const content = this.generateEmailContent(
      {
        userName: props.userName,
        message: props.message,
        actionUrl: props.actionUrl,
        actionText: props.actionText,
      },
      'notification'
    );
    if (this.queueService) {
      await this.queueService.sendEmail({
        to: props.to,
        subject: props.subject,
        compiledContent: content,
      });
    } else {
      // Send directly if no queue service
      await this.sendEmail({
        to: props.to,
        subject: props.subject,
        compiledContent: content,
      });
    }
  }

  public compileDynamicEmail(options: DynamicEmailOptions): string {
    const htmlContent = this.dynamicTemplate({
      title: options.data.title,
      sections: options.data.sections,
    });

    return htmlContent;
  }

  public async sendDynamicEmail(options: DynamicEmailOptions): Promise<void> {
    try {
      const compiledContent = this.compileDynamicEmail(options);

      const jobData = {
        to: options.to,
        subject: options.subject,
        compiledContent,
      };

      if (this.queueService) {
        await this.queueService.sendEmail(jobData);
      }

      this.logger.info('Dynamic email queued successfully', {
        to: options.to,
        subject: options.subject,
        sectionsCount: options.data.sections.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to queue dynamic email',
        error instanceof Error ? error : new Error(String(error)),
        {
          to: options.to,
          subject: options.subject,
        }
      );
      throw error;
    }
  }

  public async sendEmailWithTemplate(
    emailData: {
      to: string;
      subject: string;
      partialName: string;
      templateData: Record<string, any>;
    },
    priority: number = 5
  ): Promise<void> {
    const content = this.generateEmailContent(
      emailData.templateData,
      emailData.partialName
    );

    const jobData: EmailJobData = {
      to: emailData.to,
      subject: emailData.subject,
      compiledContent: content,
    };

    if (this.queueService) {
      await this.queueService.sendEmail(jobData);
    } else {
      // Send directly if no queue service (for mentor app)
      await this.sendEmail(jobData);
    }
  }

  // New methods for specific email types
  public async sendPasswordResetEmail(
    to: string,
    userName: string,
    otp: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Password Reset - Spiriment',
      partialName: 'password-reset',
      templateData: {
        title: 'Password Reset',
        userName,
        otp,
      },
    });
  }

  public async sendTransactionNotificationEmail(
    to: string,
    userName: string,
    message: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Transaction Successful - AptFuel',
      partialName: 'transaction-notification',
      templateData: {
        title: 'Transaction Notification',
        userName,
        message,
      },
    });
  }

  public async sendWelcomeEmail(to: string, userName: string): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Welcome to AptFuel!',
      partialName: 'welcome-email',
      templateData: {
        title: 'Welcome to AptFuel',
        userName,
      },
    });
  }

  public async sendStationManagerInviteEmail(
    to: string,
    userName: string,
    message: string,
    password: string,
    email: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Welcome to AptFuel Manager',
      partialName: 'invite-station-manager',
      templateData: {
        title: 'Station Manager Invitation',
        userName,
        message,
        password,
        email,
      },
    });
  }

  public async sendGeneralNotificationEmail(
    to: string,
    userName: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Notification - AptFuel',
      partialName: 'notification',
      templateData: {
        title: 'Notification',
        userName,
        message,
        actionUrl,
        actionText,
      },
    });
  }

  public async sendEmailVerificationEmail(
    to: string,
    userName: string,
    verificationCode: string,
    isLogin: boolean = false
  ): Promise<void> {
    this.logger.info('📧 Sending email verification', {
      to,
      userName,
      isLogin,
      verificationCodeLength: verificationCode.length,
      timestamp: new Date().toISOString(),
    });

    try {
      // Send email with template
      await this.sendEmailWithTemplate({
        to,
        subject: isLogin
          ? 'Login Verification Code - Spiriment'
          : 'Email Verification - Spiriment',
        partialName: 'email-verification',
        templateData: {
          title: isLogin ? 'Login Verification' : 'Email Verification',
          userName,
          verificationCode,
          isLogin,
        },
      });

      this.logger.info('✅ Email verification sent successfully', {
        to,
        isLogin,
      });
    } catch (error) {
      this.logger.error(
        '❌ Failed to send email verification',
        error instanceof Error ? error : new Error(String(error)),
        {
          to,
          isLogin,
        }
      );
      throw error;
    }

    // Also log for development/testing
    this.logger.info(`🔐 OTP sent to ${to}: ${verificationCode}`, {
      purpose: isLogin ? 'login' : 'verification',
    });
  }

  public async sendAdminLoginCredentialsEmail(
    to: string,
    userName: string,
    message: string,
    password: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Admin Login Credentials - AptFuel',
      partialName: 'admin-login-credentials',
      templateData: {
        title: 'Admin Login Credentials',
        userName,
        message,
        password,
      },
    });
  }

  public async sendAdminNewPasswordEmail(
    to: string,
    userName: string,
    password: string,
    url: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Your New Admin Password - AptFuel',
      partialName: 'send-admin-new-password',
      templateData: {
        title: 'Your New Admin Password',
        userName,
        password,
        url,
        currentYear: new Date().getFullYear(),
      },
    });
  }

  public async sendSubUserLoginCredentialsEmail(
    to: string,
    userName: string,
    message: string,
    password: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: 'Welcome to AptFuel - Sub-User Account Created',
      partialName: 'send-user-login-credentials',
      templateData: {
        title: 'Welcome to AptFuel',
        userName,
        message,
        email: to,
        password,
        link: 'https://aptfuel.com',
      },
    });
  }

  public async sendSessionRequestEmail(
    to: string,
    mentorName: string,
    menteeName: string,
    scheduledTime: string,
    duration: number,
    description?: string,
    sessionType?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `New Session Request from ${menteeName} - Spiriment`,
      partialName: 'session-request',
      templateData: {
        title: 'New Session Request',
        mentorName,
        menteeName,
        scheduledTime,
        duration,
        description,
        sessionType,
        appUrl: appUrl || 'spiriment://sessions',
      },
    });
  }

  public async sendSessionAcceptedEmail(
    to: string,
    menteeName: string,
    mentorName: string,
    scheduledTime: string,
    duration: number,
    sessionType?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `Session Accepted by ${mentorName} - Spiriment`,
      partialName: 'session-accepted',
      templateData: {
        title: 'Session Accepted',
        menteeName,
        mentorName,
        scheduledTime,
        duration,
        sessionType,
        appUrl: appUrl || 'spiriment://sessions',
      },
    });
  }

  public async sendSessionDeclinedEmail(
    to: string,
    menteeName: string,
    mentorName: string,
    scheduledTime: string,
    reason?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `Session Request Update - Spiriment`,
      partialName: 'session-declined',
      templateData: {
        title: 'Session Request Update',
        menteeName,
        mentorName,
        scheduledTime,
        reason,
        appUrl: appUrl || 'spiriment://mentors',
      },
    });
  }

  public async sendSessionReminderEmail(
    to: string,
    userName: string,
    partnerName: string,
    scheduledTime: string,
    duration: number,
    timeUntil: string,
    role: 'mentor' | 'mentee',
    description?: string,
    sessionType?: string,
    location?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `⏰ Session Reminder: Your session starts in ${timeUntil} - Spiriment`,
      partialName: 'session-reminder',
      templateData: {
        title: `Session Reminder - ${timeUntil}`,
        userName,
        partnerName,
        scheduledTime,
        duration,
        timeUntil,
        role,
        description,
        sessionType,
        location,
        appUrl: appUrl || 'spiriment://sessions',
      },
    });
  }

  public async sendSessionRescheduleRequestEmail(
    to: string,
    mentorName: string,
    menteeName: string,
    currentScheduledTime: string,
    newScheduledTime: string,
    duration: number,
    reason?: string,
    message?: string,
    sessionType?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `📅 Session Reschedule Request from ${menteeName} - Spiriment`,
      partialName: 'session-reschedule-request',
      templateData: {
        title: 'Session Reschedule Request',
        mentorName,
        menteeName,
        currentScheduledTime,
        newScheduledTime,
        duration,
        reason,
        message,
        sessionType,
        appUrl: appUrl || 'spiriment://sessions',
      },
    });
  }

  public async sendSessionRescheduleAcceptedEmail(
    to: string,
    menteeName: string,
    mentorName: string,
    previousScheduledTime: string,
    newScheduledTime: string,
    duration: number,
    sessionType?: string,
    location?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `✅ Session Rescheduled - ${mentorName} Accepted - Spiriment`,
      partialName: 'session-reschedule-accepted',
      templateData: {
        title: 'Session Rescheduled',
        menteeName,
        mentorName,
        previousScheduledTime,
        newScheduledTime,
        duration,
        sessionType,
        location,
        appUrl: appUrl || 'spiriment://sessions',
      },
    });
  }

  public async sendSessionRescheduleDeclinedEmail(
    to: string,
    menteeName: string,
    mentorName: string,
    scheduledTime: string,
    duration: number,
    sessionType?: string,
    location?: string,
    reason?: string,
    appUrl?: string
  ): Promise<void> {
    await this.sendEmailWithTemplate({
      to,
      subject: `Session Time Confirmed - ${mentorName} - Spiriment`,
      partialName: 'session-reschedule-declined',
      templateData: {
        title: 'Session Time Confirmed',
        menteeName,
        mentorName,
        scheduledTime,
        duration,
        sessionType,
        location,
        reason,
        appUrl: appUrl || 'spiriment://sessions',
      },
    });
  }

  // Group Session Email Methods

  public async sendGroupSessionInvitation(props: {
    to: string;
    menteeName: string;
    mentorName: string;
    sessionTitle: string;
    sessionDescription: string;
    scheduledAt: Date;
    duration: number;
    groupSessionId: string;
    participantId: string;
  }): Promise<void> {
    const { format } = await import('date-fns');
    const scheduledTime = format(props.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a");

    await this.sendEmailWithTemplate({
      to: props.to,
      subject: `Group Session Invitation - ${props.sessionTitle} - Spiriment`,
      partialName: 'group-session-invitation',
      templateData: {
        title: 'Group Session Invitation',
        menteeName: props.menteeName,
        mentorName: props.mentorName,
        sessionTitle: props.sessionTitle,
        sessionDescription: props.sessionDescription,
        scheduledTime,
        duration: props.duration,
        groupSessionId: props.groupSessionId,
        participantId: props.participantId,
        acceptUrl: `spiriment://group-sessions/${props.groupSessionId}/respond?accept=true`,
        declineUrl: `spiriment://group-sessions/${props.groupSessionId}/respond?accept=false`,
        appUrl: 'spiriment://group-sessions',
      },
    });
  }

  public async sendGroupSessionAcceptance(props: {
    to: string;
    mentorName: string;
    menteeName: string;
    sessionTitle: string;
  }): Promise<void> {
    await this.sendEmailWithTemplate({
      to: props.to,
      subject: `${props.menteeName} Accepted Your Group Session - Spiriment`,
      partialName: 'group-session-acceptance',
      templateData: {
        title: 'Group Session Accepted',
        mentorName: props.mentorName,
        menteeName: props.menteeName,
        sessionTitle: props.sessionTitle,
        appUrl: 'spiriment://group-sessions',
      },
    });
  }

  public async sendGroupSessionDecline(props: {
    to: string;
    mentorName: string;
    menteeName: string;
    sessionTitle: string;
    declineReason?: string;
  }): Promise<void> {
    await this.sendEmailWithTemplate({
      to: props.to,
      subject: `${props.menteeName} Declined Your Group Session - Spiriment`,
      partialName: 'group-session-decline',
      templateData: {
        title: 'Group Session Declined',
        mentorName: props.mentorName,
        menteeName: props.menteeName,
        sessionTitle: props.sessionTitle,
        declineReason: props.declineReason,
        appUrl: 'spiriment://group-sessions',
      },
    });
  }

  public async sendGroupSessionReminder(props: {
    to: string;
    userName: string;
    sessionTitle: string;
    scheduledAt: Date;
    duration: number;
    mentorName: string;
    timeUntilSession: string;
  }): Promise<void> {
    const { format } = await import('date-fns');
    const scheduledTime = format(props.scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a");

    await this.sendEmailWithTemplate({
      to: props.to,
      subject: `Reminder: Group Session "${props.sessionTitle}" ${props.timeUntilSession} - Spiriment`,
      partialName: 'group-session-reminder',
      templateData: {
        title: 'Group Session Reminder',
        userName: props.userName,
        sessionTitle: props.sessionTitle,
        scheduledTime,
        duration: props.duration,
        mentorName: props.mentorName,
        timeUntilSession: props.timeUntilSession,
        appUrl: 'spiriment://group-sessions',
      },
    });
  }

  public async sendGroupSessionCancellation(props: {
    to: string;
    menteeName: string;
    mentorName: string;
    sessionTitle: string;
    cancellationReason?: string;
  }): Promise<void> {
    await this.sendEmailWithTemplate({
      to: props.to,
      subject: `Group Session Cancelled - ${props.sessionTitle} - Spiriment`,
      partialName: 'group-session-cancellation',
      templateData: {
        title: 'Group Session Cancelled',
        menteeName: props.menteeName,
        mentorName: props.mentorName,
        sessionTitle: props.sessionTitle,
        cancellationReason: props.cancellationReason,
        appUrl: 'spiriment://sessions',
      },
    });
  }
}
