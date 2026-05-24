import { z } from 'zod';

export const createBlogSchema = z.object({
  title: z.string().min(3, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional().nullable(),
  coverImage: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  isPublished: z.boolean().optional().default(false),
  publishedAt: z.string().datetime().optional().nullable(),
});

export type CreateBlogDTO = z.infer<typeof createBlogSchema>;

export const updateBlogSchema = createBlogSchema.partial();
export type UpdateBlogDTO = z.infer<typeof updateBlogSchema>;
