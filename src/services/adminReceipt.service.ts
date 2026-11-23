import { EntityManager, QueryFailedError } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { AppError } from '@/common';
import {
  AdminReceipt,
  AdminReceiptPaymentMethod,
  AdminReceiptStatus,
} from '@/database/entities/adminReceipt.entity';
import type { AdminInvoice } from '@/database/entities/adminInvoice.entity';
import { adminAuditService } from './adminAudit.service';

export interface AdminReceiptPaymentInput {
  paymentDate: string;
  paymentMethod: AdminReceiptPaymentMethod;
  paymentReference?: string | null;
  receivedBy: string;
}

export interface AdminReceiptInput extends AdminReceiptPaymentInput {
  receivedFromName: string;
  receivedFromAddress?: string | null;
  receivedFromEmail?: string | null;
  currency: string;
  lineItems: { description: string; amount: number }[];
  vatRate?: number | null;
  notes?: string | null;
}

const NUMBER_PREFIX = 'SPR-R';

const toCents = (amount: number) => Math.round(amount * 100);

function isDuplicateKey(error: unknown) {
  return (
    error instanceof QueryFailedError &&
    ((error as any).code === 'ER_DUP_ENTRY' || (error as any).errno === 1062)
  );
}

class AdminReceiptService {
  private get repo() {
    return AppDataSource.getRepository(AdminReceipt);
  }

  serialize(row: AdminReceipt) {
    return {
      id: row.id,
      receiptNumber: row.receiptNumber,
      status: row.status,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      receivedFromName: row.receivedFromName,
      receivedFromAddress: row.receivedFromAddress,
      receivedFromEmail: row.receivedFromEmail,
      paymentDate: row.paymentDate,
      paymentMethod: row.paymentMethod,
      paymentReference: row.paymentReference,
      receivedBy: row.receivedBy,
      currency: row.currency,
      lineItems: (row.lineItems ?? []).map((l) => ({
        description: l.description,
        amount: l.amountCents / 100,
      })),
      vatRate: row.vatRate === null ? null : Number(row.vatRate),
      subtotal: row.subtotalCents / 100,
      vat: row.vatCents / 100,
      total: row.totalCents / 100,
      notes: row.notes,
      voidedAt: row.voidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async getRow(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new AppError('Receipt not found', 404, 'NOT_FOUND');
    return row;
  }

  async list(params: { page?: number; limit?: number; status?: AdminReceiptStatus; search?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const qb = this.repo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (params.status) qb.andWhere('r.status = :status', { status: params.status });
    if (params.search?.trim()) {
      const term = `%${params.search.trim().replace(/[%_\\]/g, '')}%`;
      qb.andWhere(
        '(r.receivedFromName LIKE :term OR r.receivedFromEmail LIKE :term OR r.receiptNumber LIKE :term OR r.invoiceNumber LIKE :term OR r.paymentReference LIKE :term)',
        { term }
      );
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((r) => this.serialize(r)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async get(id: string) {
    return this.serialize(await this.getRow(id));
  }

  /** The receipt (not void) for an invoice, if any */
  async findActiveForInvoice(invoiceId: string, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(AdminReceipt) : this.repo;
    return repo.findOne({ where: { invoiceId, status: AdminReceiptStatus.ISSUED } });
  }

  /** Next number for the payment year, e.g. SPR-R-2026-0007 */
  private async nextNumber(manager: EntityManager, year: string) {
    const prefix = `${NUMBER_PREFIX}-${year}-`;
    const last = await manager
      .getRepository(AdminReceipt)
      .createQueryBuilder('r')
      .select('r.receiptNumber', 'receiptNumber')
      .where('r.receiptNumber LIKE :p', { p: `${prefix}%` })
      .orderBy('r.receiptNumber', 'DESC')
      .limit(1)
      .getRawOne<{ receiptNumber: string }>();
    const lastSeq = last ? parseInt(last.receiptNumber.slice(prefix.length), 10) || 0 : 0;
    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  }

  /**
   * Insert a receipt with the next free number. Two receipts created at the same moment could
   * pick the same number; the unique index rejects the second, so take the next one and retry.
   * (In MySQL a duplicate-key error only fails that statement, so this is safe in a transaction.)
   */
  private async insertNumbered(manager: EntityManager, fields: Partial<AdminReceipt>) {
    const repo = manager.getRepository(AdminReceipt);
    const year = String(fields.paymentDate).slice(0, 4);
    for (let attempt = 0; attempt < 5; attempt++) {
      const receiptNumber = await this.nextNumber(manager, year);
      try {
        return await repo.save(repo.create({ ...fields, receiptNumber, status: AdminReceiptStatus.ISSUED }));
      } catch (error) {
        if (isDuplicateKey(error)) continue;
        throw error;
      }
    }
    throw new AppError('Could not assign a receipt number, please try again.', 409, 'RECEIPT_NUMBER_CONFLICT');
  }

  private paymentFields(input: AdminReceiptPaymentInput) {
    return {
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      paymentReference: input.paymentReference?.trim() || null,
      receivedBy: input.receivedBy.trim(),
    };
  }

  /** Receipt for a paid invoice. Call inside the transaction that holds the invoice row lock. */
  async createForInvoice(
    manager: EntityManager,
    invoice: AdminInvoice,
    payment: AdminReceiptPaymentInput,
    adminUserId: string
  ) {
    const saved = await this.insertNumbered(manager, {
      ...this.paymentFields(payment),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      receivedFromName: invoice.billedToName,
      receivedFromAddress: invoice.billedToAddress,
      receivedFromEmail: invoice.billedToEmail,
      currency: invoice.currency,
      lineItems: invoice.lineItems,
      vatRate: invoice.vatRate,
      subtotalCents: invoice.subtotalCents,
      vatCents: invoice.vatCents,
      totalCents: invoice.totalCents,
      notes: null,
      voidedAt: null,
      createdByAdminId: adminUserId,
    });
    await adminAuditService.log({
      adminUserId,
      action: 'admin.receipt.create',
      targetType: 'admin_receipt',
      targetId: saved.id,
      metadata: {
        receiptNumber: saved.receiptNumber,
        invoiceNumber: invoice.invoiceNumber,
        total: saved.totalCents / 100,
        currency: saved.currency,
      },
    });
    return saved;
  }

  /** Receipt for a payment that had no invoice */
  async createStandalone(input: AdminReceiptInput, adminUserId: string) {
    const lineItems = input.lineItems.map((l) => ({
      description: l.description.trim(),
      amountCents: toCents(l.amount),
    }));
    const vatRate = input.vatRate ? Number(input.vatRate) : null;
    const subtotalCents = lineItems.reduce((sum, l) => sum + l.amountCents, 0);
    const vatCents = vatRate ? Math.round((subtotalCents * vatRate) / 100) : 0;

    const saved = await AppDataSource.transaction((manager) =>
      this.insertNumbered(manager, {
        ...this.paymentFields(input),
        invoiceId: null,
        invoiceNumber: null,
        receivedFromName: input.receivedFromName.trim(),
        receivedFromAddress: input.receivedFromAddress?.trim() || null,
        receivedFromEmail: input.receivedFromEmail?.trim() || null,
        currency: input.currency,
        lineItems,
        vatRate: vatRate === null ? null : vatRate.toFixed(2),
        subtotalCents,
        vatCents,
        totalCents: subtotalCents + vatCents,
        notes: input.notes?.trim() || null,
        voidedAt: null,
        createdByAdminId: adminUserId,
      })
    );
    await adminAuditService.log({
      adminUserId,
      action: 'admin.receipt.create',
      targetType: 'admin_receipt',
      targetId: saved.id,
      metadata: {
        receiptNumber: saved.receiptNumber,
        receivedFromName: saved.receivedFromName,
        total: saved.totalCents / 100,
        currency: saved.currency,
      },
    });
    return this.serialize(saved);
  }

  async void(id: string, adminUserId: string) {
    const row = await this.getRow(id);
    if (row.status === AdminReceiptStatus.VOID) {
      throw new AppError('This receipt is already void.', 400, 'RECEIPT_VOID');
    }
    row.status = AdminReceiptStatus.VOID;
    row.voidedAt = new Date();
    const saved = await this.repo.save(row);
    await adminAuditService.log({
      adminUserId,
      action: 'admin.receipt.void',
      targetType: 'admin_receipt',
      targetId: id,
      metadata: { receiptNumber: row.receiptNumber, invoiceNumber: row.invoiceNumber },
    });
    return this.serialize(saved);
  }

  /** Void an invoice's receipt when the invoice is marked unpaid or voided */
  async voidActiveForInvoice(manager: EntityManager, invoiceId: string, adminUserId: string) {
    const active = await this.findActiveForInvoice(invoiceId, manager);
    if (!active) return null;
    active.status = AdminReceiptStatus.VOID;
    active.voidedAt = new Date();
    await manager.getRepository(AdminReceipt).save(active);
    await adminAuditService.log({
      adminUserId,
      action: 'admin.receipt.void',
      targetType: 'admin_receipt',
      targetId: active.id,
      metadata: { receiptNumber: active.receiptNumber, invoiceNumber: active.invoiceNumber, reason: 'invoice_changed' },
    });
    return active;
  }
}

export const adminReceiptService = new AdminReceiptService();
