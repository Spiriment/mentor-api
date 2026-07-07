import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractStripeCustomerId,
  extractStripeSubscriptionId,
  resolvePaymentFailedTarget,
} from './stripePaymentFailedResolver';

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
