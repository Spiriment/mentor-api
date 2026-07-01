import { z } from 'zod';

export const adminAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  adminUserId: z.string().uuid().optional(),
  action: z.string().max(128).optional(),
  targetType: z.string().max(64).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export const adminExportMonthlyBodySchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  timezone: z.string().max(64).default('UTC'),
});

export const adminExportReportTypeSchema = z.enum([
  'mentors',
  'mentees',
  'users',
  'activity',
  'subscriptions',
  'sessions',
]);

export const adminReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['open', 'in_review', 'resolved', 'dismissed', 'all']).optional(),
  assignedTo: z.string().uuid().optional(),
  reportedUserId: z.string().uuid().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export const adminReportPatchBodySchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'dismissed']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().max(2000).nullable().optional(),
});
