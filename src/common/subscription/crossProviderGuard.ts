import type {
  SubscriptionStatus,
  SubscriptionTier,
} from '@/database/entities/userSubscription.entity';

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  none: 0,
  basic: 1,
  pro: 2,
  premium: 3,
};

function isSameProviderFamily(a: string, b: string): boolean {
  const normalize = (p: string) =>
    p === 'stripe' || p === 'stripe_family' ? 'stripe' : p;
  return normalize(a) === normalize(b);
}

export type CrossProviderExisting = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  externalProvider?: string | null;
  expiresAt?: Date | null;
};

export type CrossProviderIncoming = {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  externalProvider?: string | null;
};

/** Returns true when an incoming webhook update should be ignored to protect another provider's paid access. */
export function shouldIgnoreCrossProviderUpdate(
  existing: CrossProviderExisting,
  incoming: CrossProviderIncoming,
  now: Date = new Date(),
): boolean {
  const incomingClearsPaid =
    !incoming.externalProvider &&
    (incoming.tier === 'free' || incoming.tier === 'none');
  const existingStripe =
    existing.externalProvider === 'stripe' ||
    existing.externalProvider === 'stripe_family';
  const existingPaidStripe =
    existingStripe &&
    ['active', 'past_due', 'trialing'].includes(existing.status) &&
    TIER_RANK[existing.tier] >= TIER_RANK.basic;
  if (incomingClearsPaid && existingPaidStripe) {
    return true;
  }

  if (!incoming.externalProvider || !existing.externalProvider) {
    return false;
  }
  if (isSameProviderFamily(existing.externalProvider, incoming.externalProvider)) {
    return false;
  }

  if (
    incoming.externalProvider === 'stripe' &&
    ['active', 'trialing'].includes(incoming.status) &&
    TIER_RANK[incoming.tier] >= TIER_RANK.basic
  ) {
    return false;
  }

  const existingPaid =
    ['active', 'past_due', 'trialing'].includes(existing.status) &&
    TIER_RANK[existing.tier] >= TIER_RANK.basic;
  if (!existingPaid) return false;

  const incomingUpgrade =
    incoming.status === 'active' &&
    TIER_RANK[incoming.tier] > TIER_RANK[existing.tier];
  if (incomingUpgrade) return false;

  const stillValid = !existing.expiresAt || existing.expiresAt > now;
  return stillValid || existing.status === 'active' || existing.status === 'past_due';
}
