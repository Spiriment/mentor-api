import { PaidTier, TIER_ANNUAL_PRICE_EUR, TIER_PRICE_EUR } from './subscriptionPricing';

/** Monthly recurring revenue in euro cents for RevenueCat product IDs. */
export const RC_PRODUCT_MRR_CENTS: Record<string, number> = {
  'com.spiriment.mentor.basic.monthly': Math.round(TIER_PRICE_EUR.basic * 100),
  'com.spiriment.mentor.pro.monthly': Math.round(TIER_PRICE_EUR.pro * 100),
  'com.spiriment.mentor.premium.monthly': Math.round(TIER_PRICE_EUR.premium * 100),
  'com.spiriment.mentor.basic.annual': Math.round((TIER_ANNUAL_PRICE_EUR.basic * 100) / 12),
  'com.spiriment.mentor.pro.annual': Math.round((TIER_ANNUAL_PRICE_EUR.pro * 100) / 12),
  'com.spiriment.mentor.premium.annual': Math.round((TIER_ANNUAL_PRICE_EUR.premium * 100) / 12),
};

export function mrrCentsFromRcProduct(productId: string): number {
  return RC_PRODUCT_MRR_CENTS[productId] ?? 0;
}

export function inferBillingIntervalFromProductId(productId: string): 'monthly' | 'annual' {
  return productId.includes('annual') ? 'annual' : 'monthly';
}

export function stripePriceToMrrCents(unitAmount: number, interval?: string | null): number {
  if (interval === 'year') return Math.round(unitAmount / 12);
  return unitAmount;
}

export function inferBillingIntervalFromStripeInterval(interval?: string | null): 'monthly' | 'annual' {
  return interval === 'year' ? 'annual' : 'monthly';
}

export function inferBillingIntervalFromMrr(tier: PaidTier, mrrCents: number): 'monthly' | 'annual' | null {
  const monthly = Math.round(TIER_PRICE_EUR[tier] * 100);
  const annualMonthly = Math.round((TIER_ANNUAL_PRICE_EUR[tier] * 100) / 12);
  if (mrrCents === annualMonthly) return 'annual';
  if (mrrCents === monthly) return 'monthly';
  return null;
}
