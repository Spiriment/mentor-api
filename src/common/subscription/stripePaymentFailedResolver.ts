export function extractStripeSubscriptionId(invoice: {
  subscription?: string | { id: string } | null;
}): string | undefined {
  if (typeof invoice.subscription === 'string') return invoice.subscription;
  return invoice.subscription?.id;
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
