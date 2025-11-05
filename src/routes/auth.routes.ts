import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendVerificationSchema,
  verifyEmailSchema,
  updateBasicInfoSchema,
  updateAddressSchema,
  updateSettingsSchema,
  updateAvatarSchema,
  verifyResetOtpSchema,
  emailRegistrationSchema,
  verifyOtpSchema,
  updateProfileSchema,
  selectRoleSchema,
  sendLoginOtpSchema,
  verifyLoginOtpSchema,
} from '../validation/auth.validation';
import { updateProfileSchema as updateUserProfileSchema } from '../validation/profile.validation';
import { validate } from '@/middleware/validation';
import { EncryptionServiceImpl, JwtService, RedisClient } from '@/common';
import { authMiddleware } from '@/middleware/authMiddleware';
import { authenticateToken } from '../middleware/auth.middleware';
import { DataSource } from 'typeorm';
import { EmailService } from '@/core/email.service';
import { UserRepository } from '@/repository/user.repository';

const createAuthRoutes = (
  jwtService: JwtService,
  encryptService: EncryptionServiceImpl,
  redis: RedisClient | null,
  dataSource: DataSource,
  emailService: EmailService
) => {
  const router = Router();

  const userRepository = new UserRepository(dataSource, redis || undefined);
  const authController = new AuthController(
    dataSource,
    redis,
    encryptService,
    jwtService,
    emailService,
    userRepository
  );

  router.post('/signup', validate(registerSchema), authController.register);
  router.post('/login', validate(loginSchema), authController.login);
  
  // New OTP-based login endpoints
  router.post(
    '/send-login-otp',
    validate(sendLoginOtpSchema),
    authController.sendLoginOtp
  );
  router.post(
    '/verify-login-otp',
    validate(verifyLoginOtpSchema),
    authController.verifyLoginOtp
  );
  router.post(
    '/send-verification-email',
    validate(sendVerificationSchema),
    authController.sendVerificationEmail
  );
  router.post(
    '/verify-email',
    validate(verifyEmailSchema),
    authController.verifyEmail
  );
  router.post(
    '/refresh',
    authMiddleware(jwtService),
    validate(refreshTokenSchema),
    authController.refreshToken
  );
  router.post(
    '/logout',
    authMiddleware(jwtService),
    validate(refreshTokenSchema),
    authController.logout
  );
  router.post(
    '/forgot-password',
    validate(forgotPasswordSchema),
    authController.forgotPassword
  );
  router.post(
    '/reset-password',
    validate(resetPasswordSchema),
    authController.resetPassword
  );
  router.post(
    '/verify-reset-otp',
    validate(verifyResetOtpSchema),
    authController.verifyResetOtp
  );
  router.get(
    '/verify-token',
    authMiddleware(jwtService),
    authController.verifyTokenEndpoint
  );
  router.get('/profile', authMiddleware(jwtService), authController.getProfile);
  router.put(
    '/profile/basic-info',
    authMiddleware(jwtService),
    validate(updateBasicInfoSchema),
    authController.updateBasicInfo
  );
  router.put(
    '/profile/address',
    authMiddleware(jwtService),
    validate(updateAddressSchema),
    authController.updateAddress
  );

  // Mentor App specific routes
  router.post(
    '/mentor-app/email-registration',
    validate(emailRegistrationSchema),
    authController.emailRegistration
  );
  router.post(
    '/mentor-app/verify-otp',
    validate(verifyOtpSchema),
    authController.verifyOtp
  );
  router.put(
    '/mentor-app/update-profile',
    validate(updateProfileSchema),
    authController.updateUserProfile
  );
  router.post(
    '/mentor-app/select-role',
    validate(selectRoleSchema),
    authController.selectRole
  );

  // Protected profile routes (require authentication)
  router.get('/me', authenticateToken, authController.getCurrentUserProfile);

  router.post('/update-streak', authenticateToken, authController.updateStreak);

  router.put(
    '/profile',
    authenticateToken,
    validate(updateUserProfileSchema),
    authController.updateAuthenticatedUserProfile
  );

  return router;
};

export { createAuthRoutes };
