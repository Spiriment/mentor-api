import { z } from 'zod';

export const churchCoverageTierSchema = z.object({
  tier: z.enum(['basic', 'pro', 'premium']),
});

const detailText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

/** What the church's invoices are addressed to. Blank fields are cleared. */
const churchBillingDetailsSchema = z
  .object({
    legalName: detailText(200),
    addressLine1: detailText(200),
    addressLine2: detailText(200),
    postalCode: detailText(20),
    city: detailText(120),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/, 'Choose a country')
      .nullable()
      .optional()
      .transform((value) => value || null),
    vatNumber: detailText(40),
  })
  .strict();

/** Pastors can only change where invoices go and who they're addressed to */
export const churchBillingSettingsPastorSchema = z
  .object({
    billingEmail: z.string().trim().email('Enter a valid email address').max(255).nullable().optional(),
    billingDetails: churchBillingDetailsSchema.optional(),
  })
  .strict();

/** Spiriment admins can also schedule automatic invoices and cap paid places */
export const churchBillingSettingsAdminSchema = z
  .object({
    billingEmail: z.string().trim().email('Enter a valid email address').max(255).nullable().optional(),
    billingDetails: churchBillingDetailsSchema.optional(),
    autoInvoice: z
      .object({
        enabled: z.boolean(),
        dayOfMonth: z.number().int().min(1).max(28),
      })
      .optional(),
    seatCap: z.number().int().min(1).max(100000).nullable().optional(),
  })
  .strict();
