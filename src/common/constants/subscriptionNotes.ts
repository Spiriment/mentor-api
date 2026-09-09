/** Shared `UserSubscription.notes` markers used as lightweight state flags across
 * subscription lifecycle code. Kept separate from subscription.service.ts / familyPlan.service.ts
 * so both can import them without a circular dependency. */

/** Set when a trial expires unpaid — drives the TrialExpiredScreen prompt on mobile. */
export const TRIAL_EXPIRED_NOTE = 'trial_expired_unpaid';

/** Set when a subscription is cancelled but access continues until the current period ends. */
export const CANCEL_AT_PERIOD_END_NOTE = 'cancel_at_period_end';

/** Set when a family-plan sync overwrites a trial the user started but never got to use
 * (invite checkout was already in flight when they tapped "start trial"). Lets them retry. */
export const TRIAL_PREEMPTED_NOTE = 'trial_preempted_by_family_sync';
