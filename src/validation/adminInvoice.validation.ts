import { z } from 'zod';
import { AdminInvoiceStatus } from '@/database/entities/adminInvoice.entity';

export const ADMIN_INVOICE_CURRENCIES = ['EUR', 'USD', 'GBP', 'NGN'] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const lineItem = z.object({
  description: z.string().trim().min(1, 'Each line needs a description').max(500),
  // Entered as money (e.g. 1250.5); converted to cents by the service
  amount: z.coerce.number().min(-100_000_000).max(100_000_000),
});

const invoiceFields = {
  billedToName: z.string().trim().min(1, 'Billed-to name is required').max(255),
  billedToAddress: z.string().trim().max(2000).optional().nullable(),
  billedToEmail: z
    .union([z.string().trim().email('Enter a valid email'), z.literal('')])
    .optional()
    .nullable(),
  issueDate: isoDate,
  dueDate: isoDate,
  currency: z.enum(ADMIN_INVOICE_CURRENCIES),
  lineItems: z.array(lineItem).min(1, 'Add at least one line').max(100),
  vatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
};

export const adminInvoiceCreateBodySchema = z
  .object(invoiceFields)
  .refine((v) => v.dueDate >= v.issueDate, {
    message: 'Due date cannot be before the issue date',
    path: ['dueDate'],
  });

export const adminInvoiceUpdateBodySchema = adminInvoiceCreateBodySchema;

export const adminInvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(AdminInvoiceStatus).optional(),
  search: z.string().trim().max(200).optional(),
});
