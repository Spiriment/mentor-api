import { z } from 'zod';
import { GENDER, USER_ROLE } from '@/common/constants';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[^A-Za-z0-9]/,
      'Password must contain at least one special character'
    ),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// New OTP-based login schemas
export const sendLoginOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const verifyLoginOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Invalid reset token').max(6, 'Invalid reset token'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[^A-Za-z0-9]/,
      'Password must contain at least one special character'
    ),
  email: z.string().email('Invalid email address'),
});

export const verifyResetOtpSchema = z.object({
  token: z.string().min(1, 'Invalid reset token').max(6, 'Invalid reset token'),
  email: z.string().email('Invalid email address'),
});

export const sendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().min(1, 'Verification token is required'),
});

export const updateBasicInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  middleName: z.string().optional(),
  gender: z
    .nativeEnum(GENDER, {
      errorMap: () => ({ message: 'Invalid gender' }),
    })
    .optional(),
  profile: z.string().optional(),
  avatarFolder: z.string().optional(),
});

export const updateAddressSchema = z.object({
  address: z.string().min(1, 'Address is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().min(1, 'State is required').optional(),
});

export const updateBiometricSchema = z.object({
  enabled: z.boolean().optional(),
});

export const updateNotificationSettingsSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  biometric: updateBiometricSchema.optional(),
  notifications: updateNotificationSettingsSchema.optional(),
});

export const updateAvatarSchema = z.object({
  avatar: z
    .object({
      url: z.string().url('Invalid avatar URL').optional(),
      publicId: z.string().optional(),
    })
    .optional(),
  profile: z.string().optional(),
  folder: z.string().optional(),
});

export type RegisterDTO = z.infer<typeof registerSchema>;
export type LoginDTO = z.infer<typeof loginSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;
export type SendVerificationDTO = z.infer<typeof sendVerificationSchema>;
export type VerifyEmailDTO = z.infer<typeof verifyEmailSchema>;
// Mentor App specific schemas
export const emailRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const updateProfileSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  gender: z.nativeEnum(GENDER, {
    errorMap: () => ({ message: 'Invalid gender' }),
  }),
  country: z.string().min(1, 'Country is required'),
  countryCode: z.string().min(2, 'Country code is required'),
  birthday: z.string().min(1, 'Birthday is required'),
});

export const selectRoleSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(USER_ROLE, {
    errorMap: () => ({ message: 'Invalid role' }),
  }),
});

export type UpdateBasicInfoDTO = z.infer<typeof updateBasicInfoSchema>;
export type UpdateAddressDTO = z.infer<typeof updateAddressSchema>;
export type UpdateSettingsDTO = z.infer<typeof updateSettingsSchema>;
export type UpdateAvatarDTO = z.infer<typeof updateAvatarSchema>;

// Mentor App DTOs
export type EmailRegistrationDTO = z.infer<typeof emailRegistrationSchema>;
export type VerifyOtpDTO = z.infer<typeof verifyOtpSchema>;
export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>;
export type SelectRoleDTO = z.infer<typeof selectRoleSchema>;

// Login OTP DTOs
export type SendLoginOtpDTO = z.infer<typeof sendLoginOtpSchema>;
export type VerifyLoginOtpDTO = z.infer<typeof verifyLoginOtpSchema>;
