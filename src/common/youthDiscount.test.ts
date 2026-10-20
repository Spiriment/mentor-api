import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAgeCouponId, planAgeCouponRemoval, youthDiscountExpired } from './youthDiscount';

describe('youth discount ends at 19', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  it('expires from the 19th birthday, not before', () => {
    assert.equal(youthDiscountExpired('2007-10-21', now), false); // 18, birthday tomorrow
    assert.equal(youthDiscountExpired('2007-10-20', now), true); // 19 today
    assert.equal(youthDiscountExpired('2010-01-01', now), false); // 16
    assert.equal(youthDiscountExpired(null, now), false);
  });

  it('recognises personal and family youth coupons only', () => {
    assert.ok(isAgeCouponId('spiriment_age-ab12cd34'));
    assert.ok(isAgeCouponId('spiriment_family-age-6a5ecccb-7565-48dc-b285-21fa8e04'));
    assert.ok(!isAgeCouponId('spiriment_church-ab12cd34'));
    assert.ok(!isAgeCouponId('spiriment_ambassador-faith'));
  });

  it('removes the youth coupon, keeps others, can swap in a church coupon', () => {
    const age = { id: 'di_1', couponId: 'spiriment_age-ab12cd34' };
    const promo = { id: 'di_2', couponId: 'spiriment_ambassador-faith' };
    assert.equal(planAgeCouponRemoval([promo], null), null);
    assert.deepEqual(planAgeCouponRemoval([age], null), []);
    assert.deepEqual(planAgeCouponRemoval([age, promo], null), [{ discount: 'di_2' }]);
    assert.deepEqual(planAgeCouponRemoval([age], 'spiriment_church-ab12cd34'), [{ coupon: 'spiriment_church-ab12cd34' }]);
  });
});
