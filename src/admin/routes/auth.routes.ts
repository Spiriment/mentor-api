import { Router } from 'express';
import { validate } from '@/common';
import {
  adminLoginSchema,
  adminRefreshSchema,
  adminForgotPasswordSchema,
  adminResetPasswordSchema,
} from '@/validation/adminAuth.validation';
import { AdminAuthController } from '@/controllers/adminAuth.controller';
import { AdminAuthService } from '@/services/adminAuth.service';
import { jwt } from '@/config/int-services';

const adminAuthService = new AdminAuthService(jwt);
const adminAuthController = new AdminAuthController(adminAuthService);

const router = Router();

router.post(
  '/login',
  validate(adminLoginSchema, 'body'),
  adminAuthController.login
);
router.post(
  '/refresh',
  validate(adminRefreshSchema, 'body'),
  adminAuthController.refresh
);
router.post(
  '/forgot-password',
  validate(adminForgotPasswordSchema, 'body'),
  adminAuthController.forgotPassword
);
router.post(
  '/reset-password',
  validate(adminResetPasswordSchema, 'body'),
  adminAuthController.resetPassword
);
router.post(
  '/logout',
  validate(adminRefreshSchema, 'body'),
  adminAuthController.logout
);

export default router;
