import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planChurchCouponUpdate,
  invoiceDisplayStatus,
  upsertInvoiceRecord,
  readInvoiceRecords,
  MAX_INVOICE_RECORDS,
  isAutoInvoiceDue,
  readAutoInvoiceSettings,
  type ChurchInvoiceRecord,
} from './churchBilling';

describe('planChurchCouponUpdate', () => {
  const church5 = { id: 'di_1', couponId: 'spiriment_church-ab12cd34' };
  const promo = { id: 'di_2', couponId: 'spiriment_ambassador-faith' };

  it('leaves subscriptions without a church coupon alone', () => {
    assert.equal(planChurchCouponUpdate([promo], 'spiriment_church-ab12cd34_10pct'), null);
    assert.equal(planChurchCouponUpdate([], null), null);
  });

  it('is a no-op when the church coupon already matches', () => {
    assert.equal(planChurchCouponUpdate([church5, promo], 'spiriment_church-ab12cd34'), null);
  });

  it('drops the church coupon when the member left, keeping other discounts', () => {
    assert.deepEqual(planChurchCouponUpdate([church5, promo], null), [{ discount: 'di_2' }]);
    assert.deepEqual(planChurchCouponUpdate([church5], null), []);
  });

  it('swaps to the new percent when the church discount changes', () => {
    assert.deepEqual(planChurchCouponUpdate([church5], 'spiriment_church-ab12cd34_10pct'), [
      { coupon: 'spiriment_church-ab12cd34_10pct' },
    ]);
  });

  it('restores a removed church coupon only in restore mode', () => {
    assert.equal(planChurchCouponUpdate([promo], 'spiriment_church-ab12cd34'), null);
    assert.deepEqual(planChurchCouponUpdate([promo], 'spiriment_church-ab12cd34', 'restore'), [
      { discount: 'di_2' },
      { coupon: 'spiriment_church-ab12cd34' },
    ]);
    // Restore never adds a non-church discount (e.g. the member became a mentor meanwhile)
    assert.equal(planChurchCouponUpdate([], 'spiriment_mentor-ab12cd34', 'restore'), null);
  });

  it('adds the church coupon on joining only when the subscription has no discount', () => {
    assert.deepEqual(planChurchCouponUpdate([], 'spiriment_church-ab12cd34', 'join'), [
      { coupon: 'spiriment_church-ab12cd34' },
    ]);
    // Never stacks on an existing promo / youth discount
    assert.equal(planChurchCouponUpdate([promo], 'spiriment_church-ab12cd34', 'join'), null);
    // A mentor's 30% outranks the church discount; joining doesn't add anything
    assert.equal(planChurchCouponUpdate([], 'spiriment_mentor-ab12cd34', 'join'), null);
  });

  it('swaps to another discount type (e.g. youth) without duplicating a kept coupon', () => {
    assert.deepEqual(planChurchCouponUpdate([church5, promo], 'spiriment_ambassador-faith'), [{ discount: 'di_2' }]);
  });
});

describe('church invoice records', () => {
  const rec = (o: Partial<ChurchInvoiceRecord>): ChurchInvoiceRecord => ({
    id: 'in_1',
    status: 'open',
    totalCents: 5000,
    createdAt: '2026-10-01T00:00:00Z',
    dueAt: '2026-10-15T00:00:00Z',
    paidAt: null,
    hostedInvoiceUrl: null,
    generatedBy: 'admin',
    ...o,
  });

  it('shows open invoices past their due date as overdue', () => {
    assert.equal(invoiceDisplayStatus(rec({}), new Date('2026-10-14T00:00:00Z')), 'open');
    assert.equal(invoiceDisplayStatus(rec({}), new Date('2026-10-16T00:00:00Z')), 'overdue');
    assert.equal(invoiceDisplayStatus(rec({ status: 'paid' }), new Date('2026-10-16T00:00:00Z')), 'paid');
  });

  it('merges updates into an existing invoice and keeps newest first', () => {
    const list = [rec({ id: 'in_old', createdAt: '2026-09-01T00:00:00Z' }), rec({})];
    const next = upsertInvoiceRecord(list, { id: 'in_1', status: 'paid', paidAt: '2026-10-05T00:00:00Z' }, rec({}));
    assert.equal(next.length, 2);
    assert.equal(next[0].id, 'in_1');
    assert.equal(next[0].status, 'paid');
    assert.equal(next[0].totalCents, 5000);
  });

  it('adds invoices it has not seen (e.g. created before tracking) and caps the list', () => {
    const many = Array.from({ length: MAX_INVOICE_RECORDS }, (_, i) =>
      rec({ id: `in_${i}`, createdAt: new Date(Date.UTC(2025, 0, i + 1)).toISOString() }),
    );
    const next = upsertInvoiceRecord(many, { id: 'in_new' }, rec({ createdAt: '2026-10-01T00:00:00Z' }));
    assert.equal(next.length, MAX_INVOICE_RECORDS);
    assert.equal(next[0].id, 'in_new');
    assert.ok(!next.some((r) => r.id === 'in_0'));
  });

  it('reads only well-formed records from plan metadata', () => {
    assert.deepEqual(readInvoiceRecords(null), []);
    assert.deepEqual(readInvoiceRecords({ invoices: 'x' }), []);
    assert.equal(readInvoiceRecords({ invoices: [rec({}), null, { foo: 1 }] }).length, 1);
  });
});

describe('automatic monthly church invoices', () => {
  const sys = (createdAt: string): ChurchInvoiceRecord => ({
    id: createdAt,
    status: 'open',
    totalCents: 5000,
    createdAt,
    dueAt: null,
    paidAt: null,
    hostedInvoiceUrl: null,
    generatedBy: 'system',
  });
  const on = { enabled: true, dayOfMonth: 5 };

  it('is off unless enabled', () => {
    assert.equal(isAutoInvoiceDue({ enabled: false, dayOfMonth: 1 }, [], new Date('2026-10-20T08:00:00Z')), false);
  });

  it('waits for the billing day, then catches up if that day was missed', () => {
    assert.equal(isAutoInvoiceDue(on, [], new Date('2026-10-04T08:00:00Z')), false);
    assert.equal(isAutoInvoiceDue(on, [], new Date('2026-10-05T08:00:00Z')), true);
    assert.equal(isAutoInvoiceDue(on, [], new Date('2026-10-09T08:00:00Z')), true);
  });

  it('sends one automatic invoice per month; manual invoices do not count', () => {
    assert.equal(isAutoInvoiceDue(on, [sys('2026-10-05T08:00:00Z')], new Date('2026-10-20T08:00:00Z')), false);
    assert.equal(isAutoInvoiceDue(on, [sys('2026-09-05T08:00:00Z')], new Date('2026-10-05T08:00:00Z')), true);
    const manual = { ...sys('2026-10-06T08:00:00Z'), generatedBy: 'church_portal' as const };
    assert.equal(isAutoInvoiceDue(on, [manual], new Date('2026-10-07T08:00:00Z')), true);
  });

  it('reads stored settings defensively', () => {
    assert.deepEqual(readAutoInvoiceSettings(null), { enabled: false, dayOfMonth: 1 });
    assert.deepEqual(readAutoInvoiceSettings({ autoInvoice: { enabled: true, dayOfMonth: 31 } }), { enabled: true, dayOfMonth: 1 });
  });
});
