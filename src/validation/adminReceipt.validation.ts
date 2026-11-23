import { z } from 'zod';
import {
  ADMIN_RECEIPT_PAYMENT_METHODS,
  AdminReceiptStatus,
} from '@/database/entities/adminReceipt.entity';
import { ADMIN_INVOICE_CURRENCIES } from './adminInvoice.validation';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** How the money arrived — shared by standalone receipts and "mark invoice as paid" */
const paymentFields = {
  paymentDate: isoDate,
  paymentMethod: z.enum(ADMIN_RECEIPT_PAYMENT_METHODS),
  paymentReference: z.string().trim().max(255).optional().nullable(),
  receivedBy: z.string().trim().min(1, 'Enter who received the payment').max(255),
};

export const adminReceiptPaymentBodySchema = z.object(paymentFields);

export const adminReceiptCreateBodySchema = z.object({
  ...paymentFields,
  receivedFromName: z.string().trim().min(1, 'Enter who paid').max(255),
  receivedFromAddress: z.string().trim().max(2000).optional().nullable(),
  receivedFromEmail: z
    .union([z.string().trim().email('Enter a valid email'), z.literal('')])
    .optional()
    .nullable(),
  currency: z.enum(ADMIN_INVOICE_CURRENCIES),
  lineItems: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'Each line needs a description').max(500),
        amount: z.coerce.number().min(-100_000_000).max(100_000_000),
      })
    )
    .min(1, 'Add at least one line')
    .max(100),
  vatRate: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const adminReceiptListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(AdminReceiptStatus).optional(),
  search: z.string().trim().max(200).optional(),
});
