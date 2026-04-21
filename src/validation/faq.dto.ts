import { z } from 'zod';

export const createFaqSchema = z.object({
  question: z.string().min(5, 'Question is required'),
  answer: z.string().min(5, 'Answer is required'),
  category: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  isPublished: z.boolean().optional().default(true),
});

export type CreateFaqDTO = z.infer<typeof createFaqSchema>;

export const updateFaqSchema = createFaqSchema.partial();
export type UpdateFaqDTO = z.infer<typeof updateFaqSchema>;
