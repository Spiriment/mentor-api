import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractStripeCustomerId,
  extractStripePeriodEnd,
  extractStripeSubscriptionId,
  resolvePaymentFailedTarget,
} from './stripePaymentFailedResolver';

describe('Stripe payload shapes across API versions', () => {
  it('reads the subscription id from 2025-03-31+ invoices (parent.subscription_details)', () => {
    assert.equal(
      extractStripeSubscriptionId({ parent: { subscription_details: { subscription: 'sub_new' } } }),
      'sub_new',
    );
    assert.equal(extractStripeSubscriptionId({ parent: null }), undefined);
  });

  it('reads the period end from the subscription or, on newer versions, its first item', () => {
    assert.equal(extractStripePeriodEnd({ current_period_end: 1_800_000_000 })?.getTime(), 1_800_000_000_000);
    assert.equal(
      extractStripePeriodEnd({ items: { data: [{ current_period_end: 1_800_000_000 }] } })?.getTime(),
      1_800_000_000_000,
    );
    assert.equal(extractStripePeriodEnd({}), null);
  });
});

describe('stripePaymentFailedResolver', () => {
  it('extracts subscription and customer ids from string or object refs', () => {
    assert.equal(
      extractStripeSubscriptionId({ subscription: 'sub_123' }),
      'sub_123',
    );
    assert.equal(
      extractStripeSubscriptionId({ subscription: { id: 'sub_456' } }),
      'sub_456',
    );
    assert.equal(extractStripeCustomerId({ customer: 'cus_123' }), 'cus_123');
    assert.equal(
      extractStripeCustomerId({ customer: { id: 'cus_456' } }),
      'cus_456',
    );
  });

  it('prefers family member match on subscription id', () => {
    const resolution = resolvePaymentFailedTarget({
      subscriptionId: 'sub_family',
      familyMemberUserId: 'user-family',
      externalRefUserId: 'user-individual',
      customerUserId: 'user-customer',
    });
    assert.deepEqual(resolution, { kind: 'user', userId: 'user-family' });
  });

  it('falls back to customer when subscription id is unmapped', () => {
    const resolution = resolvePaymentFailedTarget({
      subscriptionId: 'sub_unknown',
      customerId: 'cus_1',
      customerUserId: 'user-parent',
    });
    assert.deepEqual(resolution, { kind: 'user', userId: 'user-parent' });
  });

  it('reports unmapped subscription when no customer fallback exists', () => {
    const resolution = resolvePaymentFailedTarget({
      subscriptionId: 'sub_unknown',
    });
    assert.deepEqual(resolution, {
      kind: 'unresolved',
      reason: 'subscription_id_unmapped',
    });
  });

  it('resolves customer-only invoices', () => {
    const resolution = resolvePaymentFailedTarget({
      customerId: 'cus_1',
      customerUserId: 'user-1',
    });
    assert.deepEqual(resolution, { kind: 'user', userId: 'user-1' });
  });
});
