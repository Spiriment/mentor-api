import {
  SubscriptionStatus,
  SubscriptionTier,
  UserSubscription,
} from '@/database/entities/userSubscription.entity';
import type { SelectQueryBuilder } from 'typeorm';

/** Paid subscription statuses that contribute to MRR (includes grace period). */
export const MRR_STATUSES: SubscriptionStatus[] = ['active', 'past_due'];

/** Tiers that generate recurring revenue. */
export const PAYING_TIERS: SubscriptionTier[] = ['basic', 'pro', 'premium'];

/** Statuses with paid-tier entitlements (includes trial). */
export const ENTITLED_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due'];

/** Providers that are not true paying customers for ops metrics. */
export const NON_PAYING_PROVIDERS = ['admin', 'internal_test'] as const;

export function applyMrrFilters(
  qb: SelectQueryBuilder<UserSubscription>,
  alias = 's',
): SelectQueryBuilder<UserSubscription> {
  return qb
    .andWhere(`${alias}.status IN (:...mrrStatuses)`, { mrrStatuses: MRR_STATUSES })
    .andWhere(`${alias}.tier IN (:...payingTiers)`, { payingTiers: PAYING_TIERS });
}

export function applyPayingSubscriberFilters(
  qb: SelectQueryBuilder<UserSubscription>,
  alias = 's',
): SelectQueryBuilder<UserSubscription> {
  return applyMrrFilters(qb, alias);
}

/** Paying = MRR statuses + paid tiers, excluding admin comps and internal promo codes. */
export function applyTruePayingFilters(
  qb: SelectQueryBuilder<UserSubscription>,
  alias = 's',
): SelectQueryBuilder<UserSubscription> {
  applyMrrFilters(qb, alias);
  return qb
    .andWhere(
      `(${alias}.externalProvider IS NULL OR ${alias}.externalProvider NOT IN (:...nonPaying))`,
      { nonPaying: [...NON_PAYING_PROVIDERS] },
    )
    .andWhere(
      `(${alias}.notes IS NULL OR ${alias}.notes NOT LIKE :manualNote)`,
      { manualNote: '%Manually granted%' },
    );
}

export function applyEntitledPaidTierFilters(
  qb: SelectQueryBuilder<UserSubscription>,
  alias = 's',
): SelectQueryBuilder<UserSubscription> {
  return qb
    .andWhere(`${alias}.status IN (:...entitledStatuses)`, {
      entitledStatuses: ENTITLED_STATUSES,
    })
    .andWhere(`${alias}.tier IN (:...payingTiers)`, { payingTiers: PAYING_TIERS });
}
