import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * General-purpose invoices the super admin issues from the admin panel (for any client or
 * project — not tied to app users, churches or subscriptions).
 *
 * Lifecycle: draft (editable, deletable, no number) → issued (gets the next sequential number
 * and is locked) → paid. An issued invoice is never deleted, only voided, so the numbering has
 * no gaps (required for Dutch invoices).
 */
export enum AdminInvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  VOID = 'void',
}

export interface AdminInvoiceLineItem {
  description: string;
  /** In the invoice currency's minor unit (cents) */
  amountCents: number;
}

@Entity('admin_invoices')
@Index(['status', 'createdAt'])
export class AdminInvoice extends BaseEntity {
  /** e.g. SPR-2026-0001 — assigned when issued; null while a draft */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, nullable: true })
  invoiceNumber!: string | null;

  @Column({ type: 'varchar', length: 16, default: AdminInvoiceStatus.DRAFT })
  status!: AdminInvoiceStatus;

  @Column({ type: 'varchar', length: 255 })
  billedToName!: string;

  @Column({ type: 'text', nullable: true })
  billedToAddress!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  billedToEmail!: string | null;

  @Column({ type: 'date' })
  issueDate!: string;

  @Column({ type: 'date' })
  dueDate!: string;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency!: string;

  @Column({ type: 'json' })
  lineItems!: AdminInvoiceLineItem[];

  /** Optional VAT percentage, e.g. 21.00. Null = no VAT line on the invoice. */
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
  issuedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  voidedAt!: Date | null;

  @Column({ type: 'varchar', length: 36 })
  createdByAdminId!: string;
}
