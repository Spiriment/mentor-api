import { z } from 'zod';

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(64).optional(),
  search: z.string().max(200).optional(),
  role: z.enum(['mentee', 'mentor', 'inactive', 'all']).optional(),
  country: z.string().max(120).optional(),
  churchSearch: z.string().max(200).optional(),
});

export const adminUserDiscountBodySchema = z.object({
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number().positive(),
  label: z.string().max(255).optional(),
  validFrom: z.string().max(40).optional(),
  validUntil: z.string().max(40).optional().nullable(),
});

export const adminSendUserEmailBodySchema = z.object({
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(100).optional(),
});

export const adminBroadcastEmailBodySchema = z.object({
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(100).optional(),
  role: z.enum(['mentor', 'mentee', 'all']).optional(),
});
