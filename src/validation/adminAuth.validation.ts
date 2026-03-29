import { z } from 'zod';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const adminRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const createAdminUserCliSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  role: z.nativeEnum(ADMIN_ROLE),
});

export type AdminLoginDTO = z.infer<typeof adminLoginSchema>;
export type AdminRefreshDTO = z.infer<typeof adminRefreshSchema>;
