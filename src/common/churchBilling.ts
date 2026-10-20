/**
 * Pure helpers for church billing: the church coupon on members' own Stripe subscriptions,
 * and the central church invoices kept on the org plan (metadata.invoices).
 */

/**
 * Church coupons are created from the label `church-<userId8>` (see createCheckoutSession),
 * normalized by StripeService to `spiriment_church-…`; a percent-suffixed variant may follow.
 */
export const CHURCH_COUPON_PREFIX = 'spiriment_church-';

export const isChurchCouponId = (couponId: string | null | undefined): boolean =>
  !!couponId && couponId.startsWith(CHURCH_COUPON_PREFIX);

export interface AppliedDiscount {
  /** Stripe discount id (di_…) */
  id: string;
  couponId: string | null;
}

/**
 * Discounts to set on a member's subscription so the church coupon matches what they qualify
 * for now (`desiredCouponId`, or null to drop it). Other discounts (promo codes) are kept.
 * Returns null when nothing should change. With no church coupon applied, `mode` decides:
 *  - 'sync' (default): leave it alone, so subscriptions without a church discount are never touched
 *  - 'join': add it only when the subscription has no discount at all (never stacks on a promo)
 *  - 'restore': re-add one removed earlier (church suspended, then reactivated), keeping others
 */
export type ChurchCouponMode = 'sync' | 'join' | 'restore';

export function planChurchCouponUpdate(
  applied: AppliedDiscount[],
  desiredCouponId: string | null,
  mode: ChurchCouponMode = 'sync',
): Array<{ discount: string } | { coupon: string }> | null {
  const church = applied.filter((d) => isChurchCouponId(d.couponId));
  if (church.length === 0) {
    if (mode === 'sync' || !isChurchCouponId(desiredCouponId)) return null;
    if (mode === 'join' && applied.length > 0) return null;
    return [...applied.map((d) => ({ discount: d.id })), { coupon: desiredCouponId! }];
  }
  if (church.length === 1 && church[0].couponId === desiredCouponId) return null;

  const keep = applied
    .filter((d) => !isChurchCouponId(d.couponId))
    .map((d) => ({ discount: d.id }));
  // Don't stack a second discount with the same coupon
  const alreadyKept = applied.some((d) => !isChurchCouponId(d.couponId) && d.couponId === desiredCouponId);
  return desiredCouponId && !alreadyKept ? [...keep, { coupon: desiredCouponId }] : keep;
}

// ─── Central church invoices ─────────────────────────────────────────────────

export type ChurchInvoiceStatus = 'open' | 'paid' | 'void' | 'uncollectible';
export type ChurchInvoiceDisplayStatus = ChurchInvoiceStatus | 'overdue';

export interface ChurchInvoiceRecord {
  id: string;
  status: ChurchInvoiceStatus;
  totalCents: number;
  createdAt: string;
  dueAt: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  /** system = sent automatically each month */
  generatedBy: 'admin' | 'church_portal' | 'system' | 'stripe';
  /** Last failed card attempt on the hosted invoice page (the invoice stays open) */
  paymentFailedAt?: string | null;
  /** Set once super admins were alerted that this invoice is overdue */
  overdueAlertedAt?: string | null;
}

/** Kept on the plan; older invoices remain in Stripe */
export const MAX_INVOICE_RECORDS = 24;

const INVOICE_STATUSES: ChurchInvoiceStatus[] = ['open', 'paid', 'void', 'uncollectible'];

export const toInvoiceStatus = (stripeStatus: string | null | undefined): ChurchInvoiceStatus | null =>
  INVOICE_STATUSES.includes(stripeStatus as ChurchInvoiceStatus) ? (stripeStatus as ChurchInvoiceStatus) : null;

export function invoiceDisplayStatus(r: ChurchInvoiceRecord, now: Date = new Date()): ChurchInvoiceDisplayStatus {
  if (r.status === 'open' && r.dueAt && new Date(r.dueAt).getTime() < now.getTime()) return 'overdue';
  return r.status;
}

export function readInvoiceRecords(metadata: Record<string, unknown> | null | undefined): ChurchInvoiceRecord[] {
  const list = metadata?.invoices;
  return Array.isArray(list)
    ? list.filter((r): r is ChurchInvoiceRecord => !!r && typeof r === 'object' && typeof (r as any).id === 'string')
    : [];
}

/** Insert or merge one invoice, newest first, capped at MAX_INVOICE_RECORDS. */
export function upsertInvoiceRecord(
  list: ChurchInvoiceRecord[],
  update: Partial<ChurchInvoiceRecord> & { id: string },
  fallback: Omit<ChurchInvoiceRecord, 'id'>,
): ChurchInvoiceRecord[] {
  const existing = list.find((r) => r.id === update.id);
  const merged: ChurchInvoiceRecord = existing
    ? { ...existing, ...stripUndefined(update), id: update.id }
    : { ...fallback, ...stripUndefined(update), id: update.id };
  return [merged, ...list.filter((r) => r.id !== update.id)]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_INVOICE_RECORDS);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ─── Automatic monthly invoices ──────────────────────────────────────────────

export interface AutoInvoiceSettings {
  enabled: boolean;
  /** 1–28, so every month has the day */
  dayOfMonth: number;
}

export function readAutoInvoiceSettings(metadata: Record<string, unknown> | null | undefined): AutoInvoiceSettings {
  const raw = metadata?.autoInvoice as Partial<AutoInvoiceSettings> | undefined;
  const day = Number(raw?.dayOfMonth);
  return {
    enabled: raw?.enabled === true,
    dayOfMonth: Number.isInteger(day) && day >= 1 && day <= 28 ? day : 1,
  };
}

/**
 * Whether this month's automatic invoice should go out now (UTC). Catches up if the server was
 * down on the day, and never sends two automatic invoices in one month. Invoices made by hand
 * (corrections) don't count.
 */
export function isAutoInvoiceDue(
  settings: AutoInvoiceSettings,
  records: ChurchInvoiceRecord[],
  now: Date = new Date(),
): boolean {
  if (!settings.enabled || now.getUTCDate() < settings.dayOfMonth) return false;
  const month = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
  return !records.some((r) => {
    const d = new Date(r.createdAt);
    return r.generatedBy === 'system' && `${d.getUTCFullYear()}-${d.getUTCMonth()}` === month;
  });
}
