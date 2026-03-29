import { z } from 'zod';

export const adminMentorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().max(64).optional(),
  search: z.string().max(200).optional(),
  country: z.string().max(120).optional(),
  accountStatus: z.enum(['active', 'suspended', 'deleted', 'all']).optional(),
  approvedOnly: z.string().optional(),
});

export const adminMentorStatusBodySchema = z.object({
  action: z.enum(['suspend', 'unsuspend', 'remove']),
});

export const adminMentorMessageBodySchema = z.object({
  title: z.string().max(200).optional(),
  message: z.string().min(1).max(8000),
  channels: z
    .array(z.enum(['in_app', 'email', 'push']))
    .min(1)
    .optional()
    .default(['in_app', 'email']),
});
