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

/** MRR from a RevenueCat webhook event, preferring actual paid amount over catalog list price. */
export function mrrCentsFromRcEvent(event: {
  product_id?: string;
  price?: number | null;
  price_in_purchased_currency?: number | null;
}): number {
  const productId = event.product_id ?? '';
  const interval = inferBillingIntervalFromProductId(productId);
  const paidAmount = event.price_in_purchased_currency ?? event.price;

  if (paidAmount != null && paidAmount > 0) {
    const cents = Math.round(paidAmount * 100);
    return interval === 'annual' ? Math.round(cents / 12) : cents;
  }

  return mrrCentsFromRcProduct(productId);
}

export function inferBillingIntervalFromProductId(productId: string): 'monthly' | 'annual' {
  return productId.includes('annual') ? 'annual' : 'monthly';
}

export function stripePriceToMrrCents(unitAmount: number, interval?: string | null): number {
  if (interval === 'year') return Math.round(unitAmount / 12);
  return unitAmount;
}

/** MRR from a Stripe subscription object, applying subscription-level discounts. */
export function mrrCentsFromStripeSubscription(stripeSub: {
  items?: { data?: Array<{ price?: { unit_amount?: number; recurring?: { interval?: string } } }> };
  discount?: { coupon?: { percent_off?: number; amount_off?: number } };
}): number | null {
  const price = stripeSub.items?.data?.[0]?.price;
  if (price?.unit_amount == null) return null;

  let amount = price.unit_amount;
  const interval = price.recurring?.interval;
  const coupon = stripeSub.discount?.coupon;

  if (coupon?.percent_off) {
    amount = Math.round(amount * (1 - coupon.percent_off / 100));
  } else if (coupon?.amount_off) {
    amount = Math.max(0, amount - coupon.amount_off);
  }

  return stripePriceToMrrCents(amount, interval);
}

/** MRR from a paid invoice line (uses post-discount line amount). */
export function mrrCentsFromStripeInvoice(invoice: {
  lines?: {
    data?: Array<{
      type?: string;
      subscription?: string | { id?: string };
      amount?: number;
      price?: { recurring?: { interval?: string } };
      plan?: { interval?: string };
    }>;
  };
}): number | null {
  const lines = invoice.lines?.data;
  if (!lines?.length) return null;

  const line =
    lines.find((l) => l.type === 'subscription' || l.subscription) ?? lines[0];
  const amount = line.amount ?? 0;
  const interval = line.price?.recurring?.interval ?? line.plan?.interval;

  return stripePriceToMrrCents(amount, interval);
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
