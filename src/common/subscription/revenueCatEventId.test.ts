import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRevenueCatEventId } from './revenueCatEventId';

describe('resolveRevenueCatEventId', () => {
  it('uses event.id when present', () => {
    assert.equal(resolveRevenueCatEventId({ id: 'evt_123', type: 'RENEWAL' }), 'evt_123');
  });

  it('includes event timestamp in synthetic id to reduce collisions', () => {
    const base = {
      type: 'EXPIRATION',
      app_user_id: 'user-1',
      product_id: 'com.spiriment.mentor.pro.monthly',
      transaction_id: 'tx-1',
      expiration_at_ms: 1234567890,
    };

    const a = resolveRevenueCatEventId({ ...base, event_timestamp_ms: 111 });
    const b = resolveRevenueCatEventId({ ...base, event_timestamp_ms: 222 });

    assert.notEqual(a, b);
    assert.match(a, /:111$/);
    assert.match(b, /:222$/);
  });

  it('is stable for the same payload (idempotent retries)', () => {
    const event = {
      type: 'RENEWAL',
      app_user_id: 'user-1',
      product_id: 'com.spiriment.mentor.basic.monthly',
      transaction_id: 'tx-abc',
      expiration_at_ms: 999,
      purchased_at_ms: 555,
    };
    assert.equal(resolveRevenueCatEventId(event), resolveRevenueCatEventId(event));
  });
});
