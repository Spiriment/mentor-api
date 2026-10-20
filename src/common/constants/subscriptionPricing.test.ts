import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSubscriptionDiscount } from './subscriptionPricing';

const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setDate(d.getDate() - 1);
  return d;
};

describe('getSubscriptionDiscount (one discount, the biggest)', () => {
  const base = { birthday: null, role: 'mentee', mentorApprovalStatus: null, churchDiscountPercent: 0 } as any;

  it('gives a 15–18 year-old church member their 30% youth discount, not the 5% church one', () => {
    const d = getSubscriptionDiscount({ ...base, birthday: yearsAgo(16), churchDiscountPercent: 5 });
    assert.equal(d.type, 'youth');
    assert.equal(d.percent, 30);
  });

  it('gives adult church members the church discount', () => {
    const d = getSubscriptionDiscount({ ...base, birthday: yearsAgo(30), churchDiscountPercent: 10 });
    assert.equal(d.type, 'church');
    assert.equal(d.percent, 10);
  });

  it('keeps the mentor discount for approved mentors', () => {
    const d = getSubscriptionDiscount({ ...base, role: 'mentor', mentorApprovalStatus: 'approved', churchDiscountPercent: 5 });
    assert.equal(d.type, 'mentor');
    assert.equal(d.percent, 30);
  });

  it('returns no discount when none applies', () => {
    assert.equal(getSubscriptionDiscount({ ...base, birthday: yearsAgo(30) }).percent, null);
  });
});
