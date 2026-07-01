import { z } from 'zod';

export const supportTicketListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(['open', 'pending', 'resolved', 'all']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent', 'all']).optional(),
});

export const supportTicketUpdateBodySchema = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const supportTicketMessageBodySchema = z.object({
  text: z.string().trim().min(1, 'Message is required').max(10000),
  isInternal: z.boolean().optional().default(false),
});

export const supportTicketCreateBodySchema = z.object({
  subject: z.string().trim().min(3).max(255),
  message: z.string().trim().min(1).max(10000),
  type: z
    .enum([
      'technical_issue',
      'billing',
      'mentor_complaint',
      'feature_request',
      'other',
    ])
    .optional()
    .default('other'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  linkedMentorId: z.string().uuid().optional().nullable(),
});

export type SupportTicketListQuery = z.infer<typeof supportTicketListQuerySchema>;
export type SupportTicketUpdateBody = z.infer<typeof supportTicketUpdateBodySchema>;
export type SupportTicketMessageBody = z.infer<typeof supportTicketMessageBodySchema>;
export type SupportTicketCreateBody = z.infer<typeof supportTicketCreateBodySchema>;
