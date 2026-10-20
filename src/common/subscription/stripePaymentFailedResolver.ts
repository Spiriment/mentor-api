/**
 * Webhook payloads follow the API version of the Stripe webhook endpoint. From 2025-03-31
 * `invoice.subscription` moved to `invoice.parent.subscription_details.subscription`, so read both.
 */
export function extractStripeSubscriptionId(invoice: {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
}): string | undefined {
  const ref = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  if (typeof ref === 'string') return ref;
  return ref?.id;
}

/** Same version change for `subscription.current_period_end`, which moved onto the items. */
export function extractStripePeriodEnd(stripeSub: {
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> } | null;
}): Date | null {
  const unix = stripeSub.current_period_end ?? stripeSub.items?.data?.[0]?.current_period_end;
  return unix ? new Date(unix * 1000) : null;
}

export function extractStripeCustomerId(invoice: {
  customer?: string | { id: string } | null;
}): string | undefined {
  if (typeof invoice.customer === 'string') return invoice.customer;
  return invoice.customer?.id;
}

export type PaymentFailedResolution =
  | { kind: 'user'; userId: string }
  | { kind: 'unresolved'; reason: 'subscription_id_unmapped' | 'no_customer' | 'customer_not_found' };

/** Resolve which user should be marked past_due for invoice.payment_failed. */
export function resolvePaymentFailedTarget(input: {
  subscriptionId?: string;
  familyMemberUserId?: string | null;
  externalRefUserId?: string | null;
  customerId?: string;
  customerUserId?: string | null;
}): PaymentFailedResolution {
  if (input.subscriptionId) {
    if (input.familyMemberUserId) {
      return { kind: 'user', userId: input.familyMemberUserId };
    }
    if (input.externalRefUserId) {
      return { kind: 'user', userId: input.externalRefUserId };
    }
    if (input.customerId && input.customerUserId) {
      return { kind: 'user', userId: input.customerUserId };
    }
    return { kind: 'unresolved', reason: 'subscription_id_unmapped' };
  }

  if (!input.customerId) {
    return { kind: 'unresolved', reason: 'no_customer' };
  }
  if (!input.customerUserId) {
    return { kind: 'unresolved', reason: 'customer_not_found' };
  }
  return { kind: 'user', userId: input.customerUserId };
}
