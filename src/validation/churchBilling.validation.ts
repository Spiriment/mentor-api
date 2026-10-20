import { z } from 'zod';

export const churchCoverageTierSchema = z.object({
  tier: z.enum(['basic', 'pro', 'premium']),
});

/** Pastors can only change where invoices go */
export const churchBillingSettingsPastorSchema = z
  .object({
    billingEmail: z.string().trim().email('Enter a valid email address').max(255).nullable(),
  })
  .strict();

/** Spiriment admins can also schedule automatic invoices and cap paid places */
export const churchBillingSettingsAdminSchema = z
  .object({
    billingEmail: z.string().trim().email('Enter a valid email address').max(255).nullable().optional(),
    autoInvoice: z
      .object({
        enabled: z.boolean(),
        dayOfMonth: z.number().int().min(1).max(28),
      })
      .optional(),
    seatCap: z.number().int().min(1).max(100000).nullable().optional(),
  })
  .strict();
