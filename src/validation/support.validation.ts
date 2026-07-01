import { z } from 'zod';

export const userSupportTicketCreateSchema = z.object({
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
  linkedMentorId: z.string().uuid().optional().nullable(),
});

export const userSupportTicketMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message is required').max(10000),
});
