import { z } from 'zod';

export const adminProfilePatchBodySchema = z
  .object({
    firstName: z.string().max(120).nullable().optional(),
    lastName: z.string().max(120).nullable().optional(),
    avatarUrl: z.string().url().max(500).nullable().optional(),
  })
  .strict();
