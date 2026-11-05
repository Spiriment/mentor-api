import { z } from 'zod';

const teamRole = z.enum(['pastor', 'deacon', 'leader']);

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(255),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  // Required here: a pastor sees private member details, so it's never a silent default
  role: teamRole,
});

export const resendTeamInviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(255).optional(),
});

export const updateTeamMemberSchema = z
  .object({
    role: teamRole.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.role !== undefined || body.isActive !== undefined, {
    message: 'Nothing to update',
  });
