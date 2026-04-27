import { z } from 'zod';

export const createChurchPortalSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  orgPlanId: z.string().uuid().optional(),
  denomination: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(64).optional(),
  logoUrl: z.string().url().optional(),
});

export const updateChurchPortalSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  logoUrl: z.string().url().nullable().optional(),
  denomination: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  timezone: z.string().max(64).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export const createChurchPortalUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  role: z.enum(['pastor', 'deacon', 'leader']).optional().default('pastor'),
});

export const listChurchPortalsQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export type CreateChurchPortalInput = z.infer<typeof createChurchPortalSchema>;
export type UpdateChurchPortalInput = z.infer<typeof updateChurchPortalSchema>;
export type CreateChurchPortalUserInput = z.infer<typeof createChurchPortalUserSchema>;
export type ListChurchPortalsQuery = z.infer<typeof listChurchPortalsQuerySchema>;
