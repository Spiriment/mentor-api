import { Request, Response, NextFunction } from 'express';
import { EmailService } from '@/core/email.service';
import { sendSuccessResponse, sendErrorResponse } from '@/common/helpers';
import { Logger } from '@/common/logger';

export class EmailController {
  private emailService: EmailService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      service: 'email-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
    // Initialize email service without queue
    this.emailService = new EmailService(null);
  }

  /**
   * Test SMTP connection
   * GET /api/email/test-smtp
   */
  testSmtpConnection = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return sendErrorResponse(
          res,
          'Email address is required',
          400,
          'EMAIL_REQUIRED'
        );
      }

      // First verify SMTP connection
      try {
        this.logger.info('Verifying SMTP connection...');
        const transporter = (this.emailService as any).transporter;
        if (transporter) {
          await transporter.verify();
          this.logger.info('SMTP connection verified successfully');
        }
      } catch (verifyError: any) {
        this.logger.error('SMTP verification failed', verifyError);
        return sendErrorResponse(
          res,
          `SMTP connection verification failed: ${verifyError.message || 'Unknown error'}`,
          500,
          'SMTP_VERIFY_ERROR'
        );
      }

      // Try to send a test email
      try {
        await this.emailService.sendEmailVerificationEmail(
          email,
          'Test User',
          '123456',
          false
        );

        return sendSuccessResponse(res, {
          message: 'Test email sent successfully',
          email,
        });
      } catch (error: any) {
        this.logger.error('SMTP test failed', error);
        return sendErrorResponse(
          res,
          `SMTP send failed: ${error.message || 'Unknown error'}`,
          500,
          'SMTP_ERROR'
        );
      }
    } catch (error: any) {
      this.logger.error('Error testing SMTP', error);
      next(error);
    }
  };

  /**
   * Verify SMTP configuration
   * GET /api/email/verify-config
   */
  verifySmtpConfig = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { Config } = await import('@/common');
      
      const config = {
        host: Config.email.host,
        port: Config.email.port,
        user: Config.email.user ? '***configured***' : 'NOT SET',
        from: Config.email.from,
        secure: Config.email.port === 465,
      };

      return sendSuccessResponse(res, {
        message: 'SMTP configuration',
        config,
        note: 'Password is hidden for security',
      });
    } catch (error: any) {
      this.logger.error('Error verifying SMTP config', error);
      next(error);
    }
  };
}

