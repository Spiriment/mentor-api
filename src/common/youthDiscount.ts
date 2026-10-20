import { YOUTH_DISCOUNT_MAX_AGE, calcAge } from '@/common/constants/userAge';
import type { AppliedDiscount } from '@/common/churchBilling';

/**
 * The 30% youth discount (ages 15–18) is a Stripe coupon, applied "forever" at checkout. It has
 * to stop once the member turns 19: these helpers find those coupons and plan their removal.
 */

/** Youth coupons: personal checkout (`age-<user>`) and family seats (`family-age-<user>`) */
export const isAgeCouponId = (couponId: string | null | undefined): boolean =>
  !!couponId && (couponId.startsWith('spiriment_age-') || couponId.startsWith('spiriment_family-age-'));

export function youthDiscountExpired(birthday: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!birthday || Number.isNaN(new Date(birthday).getTime())) return false;
  return calcAge(birthday, now) > YOUTH_DISCOUNT_MAX_AGE;
}

/**
 * Discounts to set once the youth coupon must go: other discounts are kept, and
 * `replacementCouponId` (another discount they still qualify for, e.g. church) is added if given.
 * Null when there's no youth coupon to remove.
 */
export function planAgeCouponRemoval(
  applied: AppliedDiscount[],
  replacementCouponId: string | null,
): Array<{ discount: string } | { coupon: string }> | null {
  if (!applied.some((d) => isAgeCouponId(d.couponId))) return null;
  const keep = applied.filter((d) => !isAgeCouponId(d.couponId));
  const next: Array<{ discount: string } | { coupon: string }> = keep.map((d) => ({ discount: d.id }));
  if (replacementCouponId && !isAgeCouponId(replacementCouponId) && !keep.some((d) => d.couponId === replacementCouponId)) {
    next.push({ coupon: replacementCouponId });
  }
  return next;
}
