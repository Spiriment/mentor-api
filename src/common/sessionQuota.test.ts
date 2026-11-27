import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sameQuotaMonth } from './sessionQuota';

describe('sameQuotaMonth', () => {
  it('is true within one month and false across months or years', () => {
    assert.equal(sameQuotaMonth(new Date(2026, 10, 1, 9), new Date(2026, 10, 30, 23, 59)), true);
    assert.equal(sameQuotaMonth(new Date(2026, 10, 30, 23, 59), new Date(2026, 11, 1, 0, 0)), false);
    assert.equal(sameQuotaMonth(new Date(2026, 11, 15), new Date(2027, 11, 15)), false);
  });
});
