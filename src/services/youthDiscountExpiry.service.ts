import { Between, IsNull, MoreThan } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/int-services';
import { User } from '@/database/entities/user.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { YOUTH_DISCOUNT_MAX_AGE } from '@/common/constants/userAge';
import { discountCouponLabel, getSubscriptionDiscount } from '@/common/constants/subscriptionPricing';
import { youthDiscountExpired } from '@/common/youthDiscount';
import { stripeService } from './stripe.service';

/** People whose 19th birthday was within this many days are re-checked (covers the launch year) */
const PERSONAL_LOOKBACK_DAYS = 400;

/**
 * Daily: end the 30% youth discount for members who have turned 19, from their next bill.
 * - Family seats: coupon removed and the member's ageDiscountPercent set to 0.
 * - Teens paying for themselves by card: coupon removed, replaced by any other discount they
 *   still qualify for (e.g. church).
 * App Store prices were never discounted. Safe to run repeatedly.
 */
export async function runYouthDiscountExpiry(now: Date = new Date()): Promise<{ family: number; personal: number; failed: number }> {
  let family = 0;
  let personal = 0;
  let failed = 0;

  // ── Family seats ─────────────────────────────────────────────────────────────
  const memberRepo = AppDataSource.getRepository(FamilyMember);
  const discounted = await memberRepo.find({
    where: { ageDiscountPercent: MoreThan(0), removedAt: IsNull() },
    relations: ['user'],
  });
  for (const member of discounted) {
    if (!youthDiscountExpired(member.user?.birthday, now)) continue;
    try {
      if (member.stripeSubscriptionId?.startsWith('sub_')) {
        await stripeService.removeYouthCoupon(member.stripeSubscriptionId, async () => null);
      }
      member.ageDiscountPercent = 0;
      await memberRepo.save(member);
      family++;
    } catch (err) {
      failed++;
      logger.warn('Youth discount expiry failed (family seat)', {
        userId: member.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Personal card subscriptions ──────────────────────────────────────────────
  // Born between (19 years + lookback) and 19 years ago
  const turned19By = new Date(now);
  turned19By.setFullYear(turned19By.getFullYear() - (YOUTH_DISCOUNT_MAX_AGE + 1));
  const turned19From = new Date(turned19By.getTime() - PERSONAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const users = await AppDataSource.getRepository(User).find({
    where: { birthday: Between(turned19From, turned19By) as any },
    select: ['id', 'birthday', 'role', 'mentorApprovalStatus', 'churchDiscountPercent'],
  });
  const subRepo = AppDataSource.getRepository(UserSubscription);
  for (const user of users) {
    if (!youthDiscountExpired(user.birthday, now)) continue;
    const sub = await subRepo.findOne({ where: { userId: user.id, externalProvider: 'stripe' } });
    if (!sub?.externalRef?.startsWith('sub_')) continue;
    try {
      const changed = await stripeService.removeYouthCoupon(sub.externalRef, async () => {
        const discount = getSubscriptionDiscount(user); // no longer includes youth
        return discount.percent !== null
          ? stripeService.getOrCreatePercentageCoupon(discount.percent, discountCouponLabel(discount.type, user.id))
          : null;
      });
      if (changed) personal++;
    } catch (err) {
      failed++;
      logger.warn('Youth discount expiry failed (personal)', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { family, personal, failed };
}
