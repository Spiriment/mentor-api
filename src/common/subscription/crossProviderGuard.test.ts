import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldIgnoreCrossProviderUpdate } from './crossProviderGuard';

describe('shouldIgnoreCrossProviderUpdate', () => {
  it('ignores RC expiration clearing provider when active Stripe sub exists', () => {
    const ignore = shouldIgnoreCrossProviderUpdate(
      {
        tier: 'pro',
        status: 'active',
        externalProvider: 'stripe',
        expiresAt: null,
      },
      {
        tier: 'free',
        status: 'active',
        externalProvider: null,
      },
    );
    assert.equal(ignore, true);
  });

  it('allows Stripe checkout to override RevenueCat', () => {
    const ignore = shouldIgnoreCrossProviderUpdate(
      {
        tier: 'basic',
        status: 'active',
        externalProvider: 'revenuecat',
        expiresAt: new Date('2030-01-01'),
      },
      {
        tier: 'pro',
        status: 'active',
        externalProvider: 'stripe',
      },
    );
    assert.equal(ignore, false);
  });

  it('blocks RevenueCat downgrade while Stripe paid access is valid', () => {
    const ignore = shouldIgnoreCrossProviderUpdate(
      {
        tier: 'premium',
        status: 'active',
        externalProvider: 'stripe',
        expiresAt: new Date('2030-01-01'),
      },
      {
        tier: 'basic',
        status: 'active',
        externalProvider: 'revenuecat',
      },
    );
    assert.equal(ignore, true);
  });

  it('treats stripe_family as same provider family as stripe', () => {
    const ignore = shouldIgnoreCrossProviderUpdate(
      {
        tier: 'pro',
        status: 'active',
        externalProvider: 'stripe_family',
        expiresAt: null,
      },
      {
        tier: 'pro',
        status: 'past_due',
        externalProvider: 'stripe',
      },
    );
    assert.equal(ignore, false);
  });
});
