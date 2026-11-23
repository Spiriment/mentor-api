import { EntityManager, QueryFailedError } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { AppError } from '@/common';
import {
  AdminInvoice,
  AdminInvoiceStatus,
} from '@/database/entities/adminInvoice.entity';
import { adminAuditService } from './adminAudit.service';
import {
  adminReceiptService,
  RECEIPT_TX_ISOLATION,
  type AdminReceiptPaymentInput,
} from './adminReceipt.service';

export interface AdminInvoiceInput {
  billedToName: string;
  billedToAddress?: string | null;
  billedToEmail?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: { description: string; amount: number }[];
  vatRate?: number | null;
  notes?: string | null;
}

const NUMBER_PREFIX = 'SPR';

const toCents = (amount: number) => Math.round(amount * 100);

function computeTotals(lineItems: { amountCents: number }[], vatRate: number | null) {
  const subtotalCents = lineItems.reduce((sum, l) => sum + l.amountCents, 0);
  const vatCents = vatRate ? Math.round((subtotalCents * vatRate) / 100) : 0;
  return { subtotalCents, vatCents, totalCents: subtotalCents + vatCents };
}

function isDuplicateKey(error: unknown) {
  return (
    error instanceof QueryFailedError &&
    ((error as any).code === 'ER_DUP_ENTRY' || (error as any).errno === 1062)
  );
}

class AdminInvoiceService {
  private get repo() {
    return AppDataSource.getRepository(AdminInvoice);
  }

  serialize(row: AdminInvoice) {
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      billedToName: row.billedToName,
      billedToAddress: row.billedToAddress,
      billedToEmail: row.billedToEmail,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
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
      issuedAt: row.issuedAt,
      paidAt: row.paidAt,
      voidedAt: row.voidedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private applyInput(row: AdminInvoice, input: AdminInvoiceInput) {
    const lineItems = input.lineItems.map((l) => ({
      description: l.description.trim(),
      amountCents: toCents(l.amount),
    }));
    const vatRate = input.vatRate ? Number(input.vatRate) : null;
    const totals = computeTotals(lineItems, vatRate);

    row.billedToName = input.billedToName.trim();
    row.billedToAddress = input.billedToAddress?.trim() || null;
    row.billedToEmail = input.billedToEmail?.trim() || null;
    row.issueDate = input.issueDate;
    row.dueDate = input.dueDate;
    row.currency = input.currency;
    row.lineItems = lineItems;
    row.vatRate = vatRate === null ? null : vatRate.toFixed(2);
    row.subtotalCents = totals.subtotalCents;
    row.vatCents = totals.vatCents;
    row.totalCents = totals.totalCents;
    row.notes = input.notes?.trim() || null;
  }

  private async getRow(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
    return row;
  }

  async list(params: {
    page?: number;
    limit?: number;
    status?: AdminInvoiceStatus;
    search?: string;
    /** Only invoices a receipt can still be made for: issued (unpaid), or paid without a receipt */
    receiptable?: boolean;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const qb = this.repo
      .createQueryBuilder('inv')
      .orderBy('inv.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (params.status) qb.andWhere('inv.status = :status', { status: params.status });
    if (params.receiptable) {
      qb.andWhere(
        `(inv.status = :issued OR (inv.status = :paid AND NOT EXISTS (
            SELECT 1 FROM admin_receipts r WHERE r.invoiceId = inv.id AND r.status = :receiptIssued
          )))`,
        { issued: AdminInvoiceStatus.ISSUED, paid: AdminInvoiceStatus.PAID, receiptIssued: 'issued' }
      );
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim().replace(/[%_\\]/g, '')}%`;
      qb.andWhere(
        '(inv.billedToName LIKE :term OR inv.billedToEmail LIKE :term OR inv.invoiceNumber LIKE :term)',
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
    const row = await this.getRow(id);
    const receipt = await adminReceiptService.findActiveForInvoice(id);
    return {
      ...this.serialize(row),
      receipt: receipt
        ? { id: receipt.id, receiptNumber: receipt.receiptNumber, paymentDate: receipt.paymentDate }
        : null,
    };
  }

  async create(input: AdminInvoiceInput, adminUserId: string) {
    const row = this.repo.create({
      status: AdminInvoiceStatus.DRAFT,
      invoiceNumber: null,
      createdByAdminId: adminUserId,
    });
    this.applyInput(row, input);
    const saved = await this.repo.save(row);
    await adminAuditService.log({
      adminUserId,
      action: 'admin.invoice.create',
      targetType: 'admin_invoice',
      targetId: saved.id,
      metadata: { billedToName: saved.billedToName, total: saved.totalCents / 100, currency: saved.currency },
    });
    return this.serialize(saved);
  }

  async update(id: string, input: AdminInvoiceInput, adminUserId: string) {
    const row = await this.getRow(id);
    if (row.status !== AdminInvoiceStatus.DRAFT) {
      throw new AppError(
        'Only drafts can be edited. An issued invoice is final — void it and create a new one.',
        400,
        'INVOICE_LOCKED'
      );
    }
    this.applyInput(row, input);
    const saved = await this.repo.save(row);
    await adminAuditService.log({
      adminUserId,
      action: 'admin.invoice.update',
      targetType: 'admin_invoice',
      targetId: id,
      metadata: { billedToName: saved.billedToName, total: saved.totalCents / 100 },
    });
    return this.serialize(saved);
  }

  async remove(id: string, adminUserId: string) {
    const row = await this.getRow(id);
    if (row.status !== AdminInvoiceStatus.DRAFT) {
      throw new AppError(
        'Issued invoices cannot be deleted (invoice numbers must stay sequential). Void it instead.',
        400,
        'INVOICE_LOCKED'
      );
    }
    await this.repo.delete({ id });
    await adminAuditService.log({
      adminUserId,
      action: 'admin.invoice.delete',
      targetType: 'admin_invoice',
      targetId: id,
      metadata: { billedToName: row.billedToName },
    });
    return { deleted: true };
  }

  /** Next number for the issue date's year, e.g. SPR-2026-0007 */
  private async nextNumber(year: string) {
    const prefix = `${NUMBER_PREFIX}-${year}-`;
    const last = await this.repo
      .createQueryBuilder('inv')
      .select('inv.invoiceNumber', 'invoiceNumber')
      .where('inv.invoiceNumber LIKE :p', { p: `${prefix}%` })
      .orderBy('inv.invoiceNumber', 'DESC')
      .limit(1)
      .getRawOne<{ invoiceNumber: string }>();
    const lastSeq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) || 0 : 0;
    return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
  }

  async issue(id: string, adminUserId: string) {
    const row = await this.getRow(id);
    if (row.status !== AdminInvoiceStatus.DRAFT) {
      throw new AppError('This invoice has already been issued.', 400, 'INVOICE_LOCKED');
    }
    if (!row.lineItems?.length) {
      throw new AppError('Add at least one line before issuing.', 400, 'INVOICE_EMPTY');
    }
    const year = String(row.issueDate).slice(0, 4);

    // Two invoices issued at the same moment could pick the same number; the unique index
    // rejects the second, so take the next one and retry.
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNumber = await this.nextNumber(year);
      try {
        const result = await this.repo
          .createQueryBuilder()
          .update(AdminInvoice)
          .set({ invoiceNumber, status: AdminInvoiceStatus.ISSUED, issuedAt: new Date() })
          .where('id = :id AND status = :draft', { id, draft: AdminInvoiceStatus.DRAFT })
          .execute();
        if (!result.affected) {
          throw new AppError('This invoice has already been issued.', 400, 'INVOICE_LOCKED');
        }
        await adminAuditService.log({
          adminUserId,
          action: 'admin.invoice.issue',
          targetType: 'admin_invoice',
          targetId: id,
          metadata: { invoiceNumber, billedToName: row.billedToName, total: row.totalCents / 100, currency: row.currency },
        });
        return this.get(id);
      } catch (error) {
        if (isDuplicateKey(error)) continue;
        throw error;
      }
    }
    throw new AppError('Could not assign an invoice number, please try again.', 409, 'INVOICE_NUMBER_CONFLICT');
  }

  /** Lock the invoice row for the rest of the transaction (no double "mark paid" clicks) */
  private async lockRow(manager: EntityManager, id: string) {
    const row = await manager
      .getRepository(AdminInvoice)
      .createQueryBuilder('inv')
      .setLock('pessimistic_write')
      .where('inv.id = :id', { id })
      .getOne();
    if (!row) throw new AppError('Invoice not found', 404, 'NOT_FOUND');
    return row;
  }

  /** Mark an issued invoice as paid and issue its receipt in one step */
  async markPaid(id: string, payment: AdminReceiptPaymentInput, adminUserId: string) {
    const receipt = await AppDataSource.transaction(RECEIPT_TX_ISOLATION, async (manager) => {
      const row = await this.lockRow(manager, id);
      if (row.status === AdminInvoiceStatus.DRAFT) {
        throw new AppError('Issue the invoice first.', 400, 'INVOICE_NOT_ISSUED');
      }
      if (row.status === AdminInvoiceStatus.VOID) {
        throw new AppError('A voided invoice cannot be changed.', 400, 'INVOICE_VOID');
      }
      if (row.status === AdminInvoiceStatus.PAID) {
        throw new AppError('This invoice is already marked as paid.', 400, 'INVOICE_ALREADY_PAID');
      }
      row.status = AdminInvoiceStatus.PAID;
      row.paidAt = new Date();
      await manager.getRepository(AdminInvoice).save(row);
      return adminReceiptService.createForInvoice(manager, row, payment, adminUserId);
    });
    await adminReceiptService.logCreated(receipt, adminUserId);
    await adminAuditService.log({
      adminUserId,
      action: 'admin.invoice.mark_paid',
      targetType: 'admin_invoice',
      targetId: id,
      metadata: { paymentDate: payment.paymentDate, paymentMethod: payment.paymentMethod },
    });
    return this.get(id);
  }

  /**
   * Receipt for an invoice that is already paid but has none (paid before receipts existed,
   * or its receipt was voided to correct a mistake)
   */
  async createReceipt(id: string, payment: AdminReceiptPaymentInput, adminUserId: string) {
    const receipt = await AppDataSource.transaction(RECEIPT_TX_ISOLATION, async (manager) => {
      const row = await this.lockRow(manager, id);
      if (row.status !== AdminInvoiceStatus.PAID) {
        throw new AppError('Only a paid invoice can get a receipt. Mark it as paid instead.', 400, 'INVOICE_NOT_PAID');
      }
      if (await adminReceiptService.findActiveForInvoice(id, manager)) {
        throw new AppError('This invoice already has a receipt. Void it first to issue a new one.', 400, 'RECEIPT_EXISTS');
      }
      return adminReceiptService.createForInvoice(manager, row, payment, adminUserId);
    });
    await adminReceiptService.logCreated(receipt, adminUserId);
    return this.get(id);
  }

  /** Undo "mark as paid" (back to issued) or void. Either way its receipt is voided too. */
  async setStatus(id: string, status: AdminInvoiceStatus.ISSUED | AdminInvoiceStatus.VOID, adminUserId: string) {
    let invoiceNumber: string | null = null;
    const voided = await AppDataSource.transaction(async (manager) => {
      const row = await this.lockRow(manager, id);
      invoiceNumber = row.invoiceNumber;
      if (row.status === AdminInvoiceStatus.DRAFT) {
        throw new AppError('Issue the invoice first.', 400, 'INVOICE_NOT_ISSUED');
      }
      if (row.status === AdminInvoiceStatus.VOID) {
        throw new AppError('A voided invoice cannot be changed.', 400, 'INVOICE_VOID');
      }
      if (status === AdminInvoiceStatus.ISSUED) {
        if (row.status !== AdminInvoiceStatus.PAID) {
          throw new AppError('This invoice is not marked as paid.', 400, 'INVOICE_NOT_PAID');
        }
        row.status = AdminInvoiceStatus.ISSUED;
        row.paidAt = null;
      } else {
        row.status = AdminInvoiceStatus.VOID;
        row.voidedAt = new Date();
      }
      await manager.getRepository(AdminInvoice).save(row);
      return adminReceiptService.voidActiveForInvoice(manager, id);
    });
    if (voided) await adminReceiptService.logVoided(voided, adminUserId, 'invoice_changed');
    await adminAuditService.log({
      adminUserId,
      action: `admin.invoice.${status === AdminInvoiceStatus.ISSUED ? 'mark_unpaid' : 'void'}`,
      targetType: 'admin_invoice',
      targetId: id,
      metadata: { invoiceNumber, voidedReceipt: voided?.receiptNumber ?? null },
    });
    return this.get(id);
  }

  /** Start a new draft from any invoice (handy after voiding, or for recurring clients) */
  async duplicate(id: string, adminUserId: string) {
    const src = await this.getRow(id);
    const today = new Date().toISOString().slice(0, 10);
    const dueOffsetDays = Math.max(
      0,
      Math.round((Date.parse(src.dueDate) - Date.parse(src.issueDate)) / 86400000)
    );
    const due = new Date(Date.now() + dueOffsetDays * 86400000).toISOString().slice(0, 10);
    return this.create(
      {
        billedToName: src.billedToName,
        billedToAddress: src.billedToAddress,
        billedToEmail: src.billedToEmail,
        issueDate: today,
        dueDate: due,
        currency: src.currency,
        lineItems: src.lineItems.map((l) => ({ description: l.description, amount: l.amountCents / 100 })),
        vatRate: src.vatRate === null ? null : Number(src.vatRate),
        notes: src.notes,
      },
      adminUserId
    );
  }
}

export const adminInvoiceService = new AdminInvoiceService();
