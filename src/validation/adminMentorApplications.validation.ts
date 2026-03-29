import { z } from 'zod';

export const mentorApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(64).optional(),
  search: z.string().max(200).optional(),
  status: z
    .enum([
      'pending_review',
      'approved',
      'rejected',
      'needs_more_info',
      'draft',
      'all',
    ])
    .optional(),
  country: z.string().max(120).optional(),
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
});

export const mentorApplicationNoteBodySchema = z.object({
  body: z.string().min(1).max(5000),
});

export const mentorApplicationDecisionBodySchema = z.object({
  action: z.enum(['approve', 'reject', 'needs_more_info']),
  messageOverride: z.string().max(8000).optional(),
  templateId: z.string().max(128).optional(),
});
