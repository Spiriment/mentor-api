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
