import { z } from 'zod';
import { REPORT_REASONS, REPORT_SOURCES, MAX_REPORT_DETAILS } from '@/common/safety';

export const reportBodySchema = z.object({
  reportedUserId: z.string().uuid(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z.string().max(MAX_REPORT_DETAILS).optional(),
  source: z.enum(REPORT_SOURCES).optional(),
  messageId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

export const blockParamsSchema = z.object({
  userId: z.string().uuid(),
});
