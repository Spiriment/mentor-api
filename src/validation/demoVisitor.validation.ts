import { z } from 'zod';

export const demoVisitorSignupSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().toLowerCase().email().max(255),
});

export const demoVisitorActivitySchema = z.object({
  /** A new browser session on the demo (counted as a visit) */
  newVisit: z.boolean().optional(),
  page: z.string().max(60).optional(),
});
