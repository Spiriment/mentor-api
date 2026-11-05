import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  churchPortalId: z.string().uuid('Invalid church portal ID'),
});

export const verifyLoginCodeSchema = z.object({
  challengeId: z.string().uuid('This code has expired. Please sign in again.'),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

export const resendLoginCodeSchema = z.object({
  challengeId: z.string().uuid('This code has expired. Please sign in again.'),
});

export const acceptInviteSchema = z.object({
  inviteToken: z.string().min(1, 'Invite token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const inviteInfoSchema = z.object({
  inviteToken: z.string().min(1, 'Invite token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  churchPortalId: z.string().uuid('Invalid church portal ID'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  churchPortalId: z.string().uuid().optional(),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
