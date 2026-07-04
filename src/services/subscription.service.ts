import { addDays } from 'date-fns';
import { StatusCodes } from 'http-status-codes';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserSubscription, SubscriptionTier, SubscriptionStatus } from '@/database/entities/userSubscription.entity';
import { PromoCode } from '@/database/entities/promoCode.entity';
import { PromoCodeRedemption } from '@/database/entities/promoCodeRedemption.entity';
import { AppError } from '@/common';
import { stripeService } from './stripe.service';
import { EmailService } from '@/core/email.service';
import { buildPricingPreview, getSubscriptionDiscount } from '@/common/constants/subscriptionPricing';
import { APP_DEEP_LINK_CANCEL, APP_DEEP_LINK_SUCCESS } from '@/common/constants/appDeepLinks';
import { inferBillingIntervalFromMrr } from '@/common/constants/subscriptionMrr';
import { logger } from '@/config/int-services';

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, none: 0, basic: 1, pro: 2, premium: 3 };
const SESSIONS_PER_MONTH: Record<SubscriptionTier, number> = { free: 0, none: 0, basic: 0, pro: 1, premium: 4 };
const TRIAL_DAYS = 7;
const GRACE_PERIOD_DAYS = 1;
const MAX_INTERNAL_TEST_CODES = 3;
export const TRIAL_EXPIRED_NOTE = 'trial_expired_unpaid';
export const CANCEL_AT_PERIOD_END_NOTE = 'cancel_at_period_end';

export class SubscriptionService {
  private emailService: EmailService;

  constructor(emailService: EmailService) {
    this.emailService = emailService;
  }

  private get subRepo() {
    return AppDataSource.getRepository(UserSubscription);
  }

  private get promoRepo() {
    return AppDataSource.getRepository(PromoCode);
  }

  private get redemptionRepo() {
    return AppDataSource.getRepository(PromoCodeRedemption);
  }

  // ─── Trial ──────────────────────────────────────────────────────────────────

  async createTrialForUser(userId: string): Promise<void> {
    const existing = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (existing) return;

    const sub = this.subRepo.create({
      user: { id: userId } as User,
      tier: 'premium',
      status: 'trialing',
      currency: 'EUR',
      expiresAt: addDays(new Date(), TRIAL_DAYS),
      mrrCents: null,
    });
    await this.subRepo.save(sub);
  }

  // ─── Read ────────────────────────────────────────────────────────────────────

  async getSubscriptionForUser(userId: string) {
    const sub = await this.subRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

    const tier: SubscriptionTier = sub?.status === 'canceled' ? 'none' : (sub?.tier ?? 'none');
    const sessionsAllowed = SESSIONS_PER_MONTH[tier];
    const sessionsUsed = await this.countSessionsThisMonth(userId);

    const pricingPreview = sub?.user ? buildPricingPreview(sub.user) : null;
    const cancelAtPeriodEnd = sub?.notes === CANCEL_AT_PERIOD_END_NOTE;

    return {
      tier,
      status: sub?.status ?? 'none',
      isTrialing: sub?.status === 'trialing',
      trialEndsAt: sub?.status === 'trialing' ? sub.expiresAt : null,
      shouldShowTrialExpiredPrompt: sub?.notes === TRIAL_EXPIRED_NOTE,
      sessionsUsed,
      sessionsAllowed,
      sessionsRemaining: Math.max(0, sessionsAllowed - sessionsUsed),
      expiresAt: sub?.expiresAt ?? null,
      currentPeriodEnd: sub?.expiresAt ?? null,
      cancelAtPeriodEnd,
      billingInterval: sub?.billingInterval ?? null,
      currency: sub?.currency ?? 'EUR',
      externalRef: sub?.externalRef ?? null,
      pricingPreview,
    };
  }

  private async countSessionsThisMonth(userId: string, manager?: EntityManager): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const runQuery = manager
      ? manager.query.bind(manager)
      : AppDataSource.query.bind(AppDataSource);

    const result = await runQuery(
      `SELECT COUNT(*) as cnt FROM sessions
       WHERE (menteeId = ? OR mentorId = ?)
         AND status IN ('completed','in_progress','scheduled','confirmed')
         AND scheduledAt >= ?`,
      [userId, userId, startOfMonth],
    );
    return parseInt(result[0]?.cnt ?? '0', 10);
  }

  canAccessTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
    return TIER_RANK[userTier] >= TIER_RANK[required];
  }

  async assertSessionQuotaAvailable(userId: string, manager?: EntityManager): Promise<void> {
    const subRepo = manager ? manager.getRepository(UserSubscription) : this.subRepo;
    const sub = manager
      ? await subRepo.findOne({
          where: { user: { id: userId } },
          lock: { mode: 'pessimistic_write' },
        })
      : await subRepo.findOne({ where: { user: { id: userId } } });
    const tier: SubscriptionTier =
      sub && ['active', 'trialing', 'past_due'].includes(sub.status) ? sub.tier : 'none';
    const allowed = SESSIONS_PER_MONTH[tier];

    if (allowed === 0) {
      throw new AppError('Your plan does not include mentorship sessions', StatusCodes.FORBIDDEN);
    }

    const used = await this.countSessionsThisMonth(userId, manager);
    if (used >= allowed) {
      throw new AppError(
        `Monthly session limit reached (${allowed} per month)`,
        StatusCodes.FORBIDDEN,
        'SESSION_QUOTA_EXCEEDED',
      );
    }
  }

  async completePromoRedemption(userId: string, promoCodeId: string): Promise<void> {
    const promoCode = await this.promoRepo.findOne({ where: { id: promoCodeId, isActive: true } });
    if (!promoCode) return;

    const redemption = await this.redemptionRepo.findOne({
      where: { user: { id: userId }, promoCode: { id: promoCodeId } },
    });

    if (redemption?.completedAt) return;

    if (promoCode.usageLimit !== null && promoCode.usedCount >= promoCode.usageLimit!) {
      return;
    }

    if (redemption) {
      redemption.completedAt = new Date();
      await this.redemptionRepo.save(redemption);
    } else {
      await this.redemptionRepo.save(
        this.redemptionRepo.create({
          promoCode,
          user: { id: userId } as User,
          redeemedAt: new Date(),
          completedAt: new Date(),
        }),
      );
    }

    await this.promoRepo.increment({ id: promoCode.id }, 'usedCount', 1);
  }

  // ─── Checkout ────────────────────────────────────────────────────────────────

  async assertCheckoutAllowed(userId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (!sub) return;

    const hasPaidTier = TIER_RANK[sub.tier] >= TIER_RANK.basic;
    const isBlockingStatus = ['active', 'past_due'].includes(sub.status);
    if (!hasPaidTier || !isBlockingStatus) return;

    const provider = sub.externalProvider ?? '';

    if (provider === 'revenuecat') {
      throw new AppError(
        'You already have an active App Store subscription. Manage it in the App Store before subscribing elsewhere.',
        StatusCodes.CONFLICT,
      );
    }
    if (provider === 'stripe_family') {
      throw new AppError(
        'Your subscription is managed through a family plan.',
        StatusCodes.CONFLICT,
      );
    }
    if (provider === 'internal_test') {
      throw new AppError('You already have an active subscription.', StatusCodes.CONFLICT);
    }
    if (provider === 'stripe') {
      throw new AppError(
        'You already have an active subscription. Use Manage Subscription to change your plan.',
        StatusCodes.CONFLICT,
      );
    }
  }

  async createCheckoutSession(user: User, tier: 'basic' | 'pro' | 'premium', interval: 'monthly' | 'annual' = 'monthly'): Promise<string> {
    await this.assertCheckoutAllowed(user.id);

    let couponId: string | undefined;

    const discount = getSubscriptionDiscount(user);
    if (discount.percent !== null) {
      const couponPrefix =
        discount.type === 'mentor' ? 'mentor' : discount.type === 'church' ? 'church' : 'age';
      couponId = await stripeService.createPercentageCoupon(
        discount.percent,
        `${couponPrefix}-${user.id.slice(0, 8)}`,
      );
    }

    const url = await stripeService.createCheckoutSession({
      user,
      tier,
      interval,
      successUrl: APP_DEEP_LINK_SUCCESS,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
    });
    return url;
  }

  async getBillingPortalUrl(user: User): Promise<string> {
    return stripeService.createBillingPortalSession(user, APP_DEEP_LINK_SUCCESS);
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────────

  async cancelSubscription(userId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (!sub) throw new AppError('No active subscription found', 404);
    if (!sub.externalRef) throw new AppError('No Stripe subscription found', 400);
    if (sub.externalProvider !== 'stripe') {
      throw new AppError('Cancel via the App Store for Apple subscriptions', 400);
    }

    await stripeService.cancelSubscriptionAtPeriodEnd(sub.externalRef);
  }

  // ─── Promo codes ─────────────────────────────────────────────────────────────

  async redeemPromoCode(user: User, code: string): Promise<{ checkoutUrl: string | null; bypassStripe: boolean; tier: string }> {
    const promoCode = await this.promoRepo.findOne({ where: { code, isActive: true } });

    if (!promoCode) throw new AppError('Invalid or expired promo code', 400);
    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      throw new AppError('This promo code has expired', 400);
    }
    if (promoCode.usageLimit !== null && promoCode.usedCount >= promoCode.usageLimit!) {
      throw new AppError('This promo code has reached its usage limit', 400);
    }

    const existingRedemption = await this.redemptionRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (existingRedemption?.completedAt) {
      throw new AppError('You have already used a promo code', 400);
    }
    if (existingRedemption && !existingRedemption.completedAt) {
      const pendingHours =
        (Date.now() - new Date(existingRedemption.redeemedAt).getTime()) / (1000 * 60 * 60);
      if (pendingHours < 24) {
        throw new AppError(
          'You already have a pending promo checkout. Complete payment before trying again.',
          400,
        );
      }
      await this.redemptionRepo.remove(existingRedemption);
    }

    if (promoCode.type === 'internal_test') {
      // Bypass Stripe — grant Premium directly
      await this.upsertSubscription(user.id, {
        tier: promoCode.tier as SubscriptionTier,
        status: 'active',
        externalProvider: 'internal_test',
        externalRef: promoCode.code,
        notes: `Internal test code: ${promoCode.code}`,
      });

      await this.redemptionRepo.save(
        this.redemptionRepo.create({ promoCode, user, redeemedAt: new Date(), completedAt: new Date() })
      );
      await this.promoRepo.increment({ id: promoCode.id }, 'usedCount', 1);

      return { checkoutUrl: null, bypassStripe: true, tier: promoCode.tier };
    }

    // Ambassador — create Stripe coupon and return checkout URL
    await this.assertCheckoutAllowed(user.id);

    const couponId = await stripeService.createPercentageCoupon(promoCode.discountPercent, code);
    const checkoutUrl = await stripeService.createCheckoutSession({
      user,
      tier: promoCode.tier as 'basic' | 'pro' | 'premium',
      successUrl: APP_DEEP_LINK_SUCCESS,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
      subscriptionMetadata: { promoCodeId: promoCode.id },
    });

    await this.redemptionRepo.save(
      this.redemptionRepo.create({
        promoCode,
        user,
        redeemedAt: new Date(),
        completedAt: null,
        stripeCouponId: couponId,
      }),
    );

    return { checkoutUrl, bypassStripe: false, tier: promoCode.tier };
  }

  // ─── Webhook sync ────────────────────────────────────────────────────────────

  async upsertSubscription(
    userId: string,
    data: {
      tier: SubscriptionTier;
      status: SubscriptionStatus;
      externalRef?: string | null;
      externalProvider?: string | null;
      mrrCents?: number | null;
      expiresAt?: Date | null;
      notes?: string | null;
      billingInterval?: 'monthly' | 'annual' | null;
    }
  ): Promise<void> {
    let sub = await this.subRepo.findOne({ where: { user: { id: userId } } });

    if (!sub) {
      sub = this.subRepo.create({
        user: { id: userId } as User,
        currency: 'EUR',
      });
    } else if (
      data.externalProvider &&
      sub.externalProvider &&
      !this.isSameProviderFamily(sub.externalProvider, data.externalProvider) &&
      this.shouldIgnoreCrossProviderUpdate(sub, data)
    ) {
      logger.warn('Ignoring cross-provider subscription sync', {
        userId,
        existingProvider: sub.externalProvider,
        incomingProvider: data.externalProvider,
        existingTier: sub.tier,
        incomingTier: data.tier,
      });
      return;
    }

    const previousStatus = sub.status;

    sub.tier = data.tier;
    sub.status = data.status;
    if (data.externalRef !== undefined) sub.externalRef = data.externalRef;
    if (data.externalProvider !== undefined) sub.externalProvider = data.externalProvider;
    if (data.mrrCents !== undefined) sub.mrrCents = data.mrrCents;
    if (data.expiresAt !== undefined) sub.expiresAt = data.expiresAt;
    if (data.billingInterval !== undefined) {
      sub.billingInterval = data.billingInterval;
    } else if (
      data.mrrCents != null &&
      ['basic', 'pro', 'premium'].includes(data.tier)
    ) {
      const inferred = inferBillingIntervalFromMrr(data.tier as 'basic' | 'pro' | 'premium', data.mrrCents);
      if (inferred) sub.billingInterval = inferred;
    }
    if (data.notes !== undefined) {
      sub.notes = data.notes ?? null;
    } else if (['basic', 'pro', 'premium'].includes(data.tier) && data.status === 'active') {
      sub.notes = null;
    }

    if (data.status === 'past_due' && previousStatus !== 'past_due') {
      sub.pastDueAt = new Date();
    } else if (data.status === 'active' || data.status === 'trialing') {
      sub.pastDueAt = null;
    }

    await this.subRepo.save(sub);
  }

  private isSameProviderFamily(a: string, b: string): boolean {
    const normalize = (p: string) => (p === 'stripe' || p === 'stripe_family' ? 'stripe' : p);
    return normalize(a) === normalize(b);
  }

  private shouldIgnoreCrossProviderUpdate(
    existing: UserSubscription,
    incoming: {
      tier: SubscriptionTier;
      status: SubscriptionStatus;
      externalProvider?: string | null;
    },
  ): boolean {
    // Successful Stripe payment always syncs — user completed web checkout
    if (
      incoming.externalProvider === 'stripe' &&
      ['active', 'trialing'].includes(incoming.status)
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

    const stillValid = !existing.expiresAt || existing.expiresAt > new Date();
    return stillValid || existing.status === 'active' || existing.status === 'past_due';
  }

  async markPastDue(userId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (!sub || sub.status === 'past_due') return;

    sub.status = 'past_due';
    sub.pastDueAt = new Date();
    await this.subRepo.save(sub);
  }

  // ─── Cron helpers ────────────────────────────────────────────────────────────

  async getExpiringTrials(daysFromNow: number): Promise<UserSubscription[]> {
    const target = addDays(new Date(), daysFromNow);
    const dayStart = new Date(target.setHours(0, 0, 0, 0));
    const dayEnd = new Date(target.setHours(23, 59, 59, 999));

    return this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.status = :status', { status: 'trialing' })
      .andWhere('s.expiresAt BETWEEN :start AND :end', { start: dayStart, end: dayEnd })
      .getMany();
  }

  async convertExpiredTrials(): Promise<number> {
    const now = new Date();
    const result = await this.subRepo
      .createQueryBuilder()
      .update(UserSubscription)
      .set({
        tier: 'free',
        status: 'active',
        expiresAt: null,
        mrrCents: null,
        externalRef: null,
        externalProvider: null,
        notes: TRIAL_EXPIRED_NOTE,
      })
      .where('status = :status', { status: 'trialing' })
      .andWhere('expiresAt < :now', { now })
      .execute();

    return result.affected ?? 0;
  }

  async acknowledgeTrialExpired(userId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (!sub || sub.notes !== TRIAL_EXPIRED_NOTE) return;

    sub.notes = null;
    await this.subRepo.save(sub);
  }

  async getPastDueSubscriptions(gracePeriodDays = GRACE_PERIOD_DAYS): Promise<UserSubscription[]> {
    const cutoff = addDays(new Date(), -gracePeriodDays);
    return this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.status = :status', { status: 'past_due' })
      .andWhere('COALESCE(s.pastDueAt, s.updatedAt) < :cutoff', { cutoff })
      .getMany();
  }

  async downgradeToFree(userId: string): Promise<void> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (!sub) return;

    if (
      sub.externalRef &&
      (sub.externalProvider === 'stripe' || sub.externalProvider === 'stripe_family')
    ) {
      try {
        await stripeService.cancelSubscription(sub.externalRef);
      } catch (err) {
        logger.warn(
          `Failed to cancel Stripe subscription during grace downgrade: userId=${userId} ref=${sub.externalRef}`,
        );
      }
    }

    await this.subRepo.update(
      { user: { id: userId } },
      {
        tier: 'free',
        status: 'active',
        mrrCents: null,
        externalRef: null,
        externalProvider: null,
        expiresAt: null,
        pastDueAt: null,
        billingInterval: null,
        notes: null,
      },
    );
  }

  async sendTrialReminderEmail(user: User, daysLeft: number): Promise<void> {
    const subject = daysLeft === 1
      ? 'Your Spiriment free trial ends tomorrow'
      : `Your Spiriment free trial ends in ${daysLeft} days`;

    const html = `
      <p>Hi ${user.firstName ?? 'there'},</p>
      <p>Your 7-day free trial of Spiriment Premium ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
      <p>After that, you'll return to <strong>Free access</strong> unless you subscribe to a paid plan. You won't be charged automatically.</p>
      <p>Open the app to choose Basic, Pro, or Premium if you'd like to keep premium features.</p>
      <p>— The Spiriment Team</p>
    `;

    await this.emailService.sendEmail({ to: user.email, subject, compiledContent: html });
  }

  async sendGracePeriodDowngradeEmail(user: User): Promise<void> {
    const html = `
      <p>Hi ${user.firstName ?? 'there'},</p>
      <p>We were unable to process your payment after ${GRACE_PERIOD_DAYS} days. Your account has returned to <strong>Free access</strong>.</p>
      <p>You can still read the Bible at no cost. Open the app and update your payment method to restore your paid plan.</p>
      <p>— The Spiriment Team</p>
    `;

    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Your Spiriment subscription has been downgraded',
      compiledContent: html,
    });
  }
}
