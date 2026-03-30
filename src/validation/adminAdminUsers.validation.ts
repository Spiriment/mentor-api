import { z } from 'zod';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';

export const adminAdminUsersListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(64).optional(),
  search: z.string().max(200).optional(),
  role: z.nativeEnum(ADMIN_ROLE).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export const adminAdminUsersCreateBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  role: z.nativeEnum(ADMIN_ROLE),
});

export const adminAdminUsersPatchStatusSchema = z.object({
  isActive: z.boolean(),
});

export const adminAdminUsersResetPasswordSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
});
