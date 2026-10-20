import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { discountCouponLabel, getSubscriptionDiscount } from '@/common/constants/subscriptionPricing';
import { logger } from '@/config/int-services';
import type { ChurchCouponMode } from '@/common/churchBilling';
import { stripeService } from './stripe.service';

/**
 * The church discount is a "forever" Stripe coupon applied at checkout, so on its own it
 * would outlive church membership and never follow 5% → 10% changes. These keep members'
 * own Stripe subscriptions in line with what they qualify for now (from the next invoice).
 * By default only subscriptions that already carry a church coupon are changed; see
 * ChurchCouponMode for joining ('join') and reactivation ('restore').
 */
export async function syncChurchCouponForUser(userId: string, mode: ChurchCouponMode = 'sync'): Promise<boolean> {
  const sub = await AppDataSource.getRepository(UserSubscription).findOne({
    where: { userId },
    select: ['id', 'externalProvider', 'externalRef'],
  });
  if (sub?.externalProvider !== 'stripe' || !sub.externalRef) return false;

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: ['id', 'birthday', 'role', 'mentorApprovalStatus', 'churchDiscountPercent'],
  });
  if (!user) return false;

  return stripeService.replaceChurchCoupon(sub.externalRef, async () => {
    const discount = getSubscriptionDiscount(user);
    return discount.percent !== null
      ? stripeService.getOrCreatePercentageCoupon(discount.percent, discountCouponLabel(discount.type, user.id))
      : null;
  }, mode);
}

/** Fire-and-forget: Stripe being slow or down must not fail joining/leaving a church. */
export function syncChurchCouponsInBackground(
  userIds: string[],
  reason: string,
  opts: { mode?: ChurchCouponMode; onDone?: (changedUserIds: string[]) => Promise<void> } = {},
): void {
  if (userIds.length === 0) {
    if (opts.onDone) void opts.onDone([]).catch(() => undefined);
    return;
  }
  void (async () => {
    const changedIds: string[] = [];
    for (const userId of userIds) {
      try {
        if (await syncChurchCouponForUser(userId, opts.mode)) changedIds.push(userId);
      } catch (err) {
        logger.warn('Church coupon sync failed', {
          userId,
          reason,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (changedIds.length > 0) {
      logger.info('Church coupons updated on Stripe subscriptions', { reason, changed: changedIds.length });
    }
    if (opts.onDone) {
      await opts.onDone(changedIds).catch((err) =>
        logger.error('Church coupon sync follow-up failed', err instanceof Error ? err : new Error(String(err)), { reason }),
      );
    }
  })();
}

/** Members of a church who pay through their own Stripe subscription. */
export async function stripePayingMemberIds(churchPortalId: string): Promise<string[]> {
  const members = await AppDataSource.getRepository(User).find({
    where: { churchPortalId },
    select: ['id'],
  });
  if (members.length === 0) return [];
  const subs = await AppDataSource.getRepository(UserSubscription).find({
    where: { userId: In(members.map((m) => m.id)), externalProvider: 'stripe' },
    select: ['userId'],
  });
  return subs.map((s) => s.userId);
}
