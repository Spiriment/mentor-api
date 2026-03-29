import { z } from 'zod';

const subscriptionTierSchema = z.enum(['basic', 'pro', 'premium', 'none']);
const subscriptionStatusSchema = z.enum([
  'active',
  'trialing',
  'canceled',
  'past_due',
]);

export const adminUserSubscriptionPutSchema = z.object({
  tier: subscriptionTierSchema,
  status: subscriptionStatusSchema,
  mrrCents: z.coerce.number().int().min(0).nullable().optional(),
  currency: z.string().min(3).max(8).optional(),
  expiresAt: z.string().max(40).nullable().optional(),
  externalProvider: z.string().max(64).nullable().optional(),
  externalRef: z.string().max(255).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const adminOrgPlanCreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  totalSeats: z.coerce.number().int().min(0),
  usedSeats: z.coerce.number().int().min(0).optional(),
  billingAdminUserId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const adminOrgPlanPatchBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    totalSeats: z.coerce.number().int().min(0).optional(),
    usedSeats: z.coerce.number().int().min(0).optional(),
    billingAdminUserId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict();

export const adminSpirimentSettingsPatchSchema = z
  .object({
    supportEmail: z.string().email().max(255).optional(),
    publicAppName: z.string().min(1).max(120).optional(),
    maintenanceMode: z.boolean().optional(),
    features: z.record(z.string(), z.boolean()).optional(),
  })
  .strict();
