import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import type { AdminInvoiceLineItem } from './adminInvoice.entity';

/**
 * Payment receipts the super admin issues from the admin panel.
 *
 * Either for a paid AdminInvoice (invoiceId set, lines and totals copied from the invoice) or
 * standalone, for a payment that never had an invoice. Receipts get their number when created
 * (SPR-R-2026-0001) and are never edited or deleted, only voided, so the numbering has no gaps.
 * An invoice has at most one receipt that isn't void.
 */
export enum AdminReceiptStatus {
  ISSUED = 'issued',
  VOID = 'void',
}

export const ADMIN_RECEIPT_PAYMENT_METHODS = [
  'bank_transfer',
  'card',
  'cash',
  'paypal',
  'other',
] as const;
export type AdminReceiptPaymentMethod = (typeof ADMIN_RECEIPT_PAYMENT_METHODS)[number];

@Entity('admin_receipts')
@Index(['status', 'createdAt'])
export class AdminReceipt extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  receiptNumber!: string;

  @Column({ type: 'varchar', length: 16, default: AdminReceiptStatus.ISSUED })
  status!: AdminReceiptStatus;

  /** The paid invoice this receipt is for; null for a standalone receipt */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  invoiceId!: string | null;

  /** Copied from the invoice at the time, so the receipt stays as printed */
  @Column({ type: 'varchar', length: 32, nullable: true })
  invoiceNumber!: string | null;

  @Column({ type: 'varchar', length: 255 })
  receivedFromName!: string;

  @Column({ type: 'text', nullable: true })
  receivedFromAddress!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  receivedFromEmail!: string | null;

  @Column({ type: 'date' })
  paymentDate!: string;

  @Column({ type: 'varchar', length: 32 })
  paymentMethod!: AdminReceiptPaymentMethod;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentReference!: string | null;

  /** Name of the person who confirmed the payment */
  @Column({ type: 'varchar', length: 255 })
  receivedBy!: string;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'json' })
  lineItems!: AdminInvoiceLineItem[];

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  vatRate!: string | null;

  @Column({ type: 'int', default: 0 })
  subtotalCents!: number;

  @Column({ type: 'int', default: 0 })
  vatCents!: number;

  @Column({ type: 'int', default: 0 })
  totalCents!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'datetime', nullable: true })
  voidedAt!: Date | null;

  @Column({ type: 'varchar', length: 36 })
  createdByAdminId!: string;
}
