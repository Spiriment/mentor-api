import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '@/common/constants/options';
import { getYouthDiscountPercent, YOUTH_DISCOUNT_PERCENT } from '@/common/constants/userAge';
import { User } from '@/database/entities/user.entity';

export const TIER_PRICE_EUR = { basic: 3, pro: 5, premium: 7.5 } as const;
export const TIER_ANNUAL_PRICE_EUR = { basic: 30, pro: 50, premium: 75 } as const;
export const MENTOR_DISCOUNT_PERCENT = 30;

export type PaidTier = keyof typeof TIER_PRICE_EUR;
export type DiscountType = 'mentor' | 'youth';

export function getMentorDiscountPercent(
  user: Pick<User, 'role' | 'mentorApprovalStatus'>,
): number | null {
  if (
    user.role === USER_ROLE.MENTOR &&
    user.mentorApprovalStatus === MENTOR_APPROVAL_STATUS.APPROVED
  ) {
    return MENTOR_DISCOUNT_PERCENT;
  }
  return null;
}

export function getSubscriptionDiscount(
  user: Pick<User, 'birthday' | 'role' | 'mentorApprovalStatus'>,
) {
  const mentorDiscount = getMentorDiscountPercent(user);
  if (mentorDiscount !== null) {
    return {
      percent: mentorDiscount,
      type: 'mentor' as DiscountType,
      label: `${MENTOR_DISCOUNT_PERCENT}% mentor discount`,
    };
  }

  const youthDiscount = getYouthDiscountPercent(user.birthday);
  if (youthDiscount !== null) {
    return {
      percent: youthDiscount,
      type: 'youth' as DiscountType,
      label: `${YOUTH_DISCOUNT_PERCENT}% youth discount`,
    };
  }

  return { percent: null, type: null as null, label: null as null };
}

export function applyDiscount(amount: number, percent: number): number {
  return Math.round(amount * (1 - percent / 100) * 100) / 100;
}

export function buildPricingPreview(user: Pick<User, 'birthday' | 'role' | 'mentorApprovalStatus'>) {
  const discount = getSubscriptionDiscount(user);
  const tiers = (['basic', 'pro', 'premium'] as PaidTier[]).reduce(
    (acc, tier) => {
      const monthlyEur = TIER_PRICE_EUR[tier];
      const annualEur = TIER_ANNUAL_PRICE_EUR[tier];
      acc[tier] = {
        monthlyEur,
        monthlyDiscountedEur:
          discount.percent !== null ? applyDiscount(monthlyEur, discount.percent) : monthlyEur,
        annualEur,
        annualDiscountedEur:
          discount.percent !== null ? applyDiscount(annualEur, discount.percent) : annualEur,
      };
      return acc;
    },
    {} as Record<
      PaidTier,
      {
        monthlyEur: number;
        monthlyDiscountedEur: number;
        annualEur: number;
        annualDiscountedEur: number;
      }
    >,
  );

  return {
    discountPercent: discount.percent,
    discountType: discount.type,
    discountLabel: discount.label,
    tiers,
  };
}
