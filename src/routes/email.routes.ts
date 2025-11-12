import { Router } from 'express';
import { EmailController } from '@/controllers/email.controller';

const router = Router();
const emailController = new EmailController();

// Test SMTP connection
router.get('/test-smtp', emailController.testSmtpConnection);

// Verify SMTP configuration
router.get('/verify-config', emailController.verifySmtpConfig);

export { router as emailRoutes };

