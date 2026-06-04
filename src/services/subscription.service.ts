import { addDays } from 'date-fns';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserSubscription, SubscriptionTier, SubscriptionStatus } from '@/database/entities/userSubscription.entity';
import { PromoCode } from '@/database/entities/promoCode.entity';
import { PromoCodeRedemption } from '@/database/entities/promoCodeRedemption.entity';
import { AppError } from '@/common';
import { stripeService } from './stripe.service';
import { EmailService } from '@/core/email.service';

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, none: 0, basic: 1, pro: 2, premium: 3 };
const SESSIONS_PER_MONTH: Record<SubscriptionTier, number> = { free: 0, none: 0, basic: 0, pro: 1, premium: 4 };

const APP_DEEP_LINK_SUCCESS = process.env.APP_DEEP_LINK ?? 'spiriment://subscription/success';
const APP_DEEP_LINK_CANCEL = process.env.APP_DEEP_LINK ?? 'spiriment://subscription/cancel';
const TRIAL_DAYS = 14;
const GRACE_PERIOD_DAYS = 3;
const MAX_INTERNAL_TEST_CODES = 3;

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

    return {
      tier,
      status: sub?.status ?? 'none',
      isTrialing: sub?.status === 'trialing',
      trialEndsAt: sub?.status === 'trialing' ? sub.expiresAt : null,
      sessionsUsed,
      sessionsAllowed,
      sessionsRemaining: Math.max(0, sessionsAllowed - sessionsUsed),
      expiresAt: sub?.expiresAt ?? null,
      currency: sub?.currency ?? 'EUR',
      externalRef: sub?.externalRef ?? null,
    };
  }

  private async countSessionsThisMonth(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await AppDataSource.query(
      `SELECT COUNT(*) as cnt FROM sessions
       WHERE (menteeId = ? OR mentorId = ?)
         AND status IN ('completed','in_progress','scheduled','confirmed')
         AND scheduledAt >= ?`,
      [userId, userId, startOfMonth]
    );
    return parseInt(result[0]?.cnt ?? '0', 10);
  }

  canAccessTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
    return TIER_RANK[userTier] >= TIER_RANK[required];
  }

  // ─── Checkout ────────────────────────────────────────────────────────────────

  private getAgeDiscountPercent(birthday: Date | string | null | undefined): number | null {
    if (!birthday) return null;
    const dob = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age >= 10 && age <= 14) return 50;
    if (age >= 15 && age <= 18) return 30;
    return null;
  }

  async createCheckoutSession(user: User, tier: 'basic' | 'pro' | 'premium'): Promise<string> {
    let couponId: string | undefined;

    const ageDiscount = this.getAgeDiscountPercent(user.birthday);
    if (ageDiscount !== null) {
      couponId = await stripeService.createPercentageCoupon(
        ageDiscount,
        `age-${user.id.slice(0, 8)}`,
      );
    }

    const url = await stripeService.createCheckoutSession({
      user,
      tier,
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

    await stripeService.cancelSubscription(sub.externalRef);
    // Webhook will handle the status update; mark locally immediately
    sub.status = 'canceled';
    await this.subRepo.save(sub);
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

    const alreadyRedeemed = await this.redemptionRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (alreadyRedeemed) throw new AppError('You have already used a promo code', 400);

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
        this.redemptionRepo.create({ promoCode, user, redeemedAt: new Date() })
      );
      await this.promoRepo.increment({ id: promoCode.id }, 'usedCount', 1);

      return { checkoutUrl: null, bypassStripe: true, tier: promoCode.tier };
    }

    // Ambassador — create Stripe coupon and return checkout URL
    const couponId = await stripeService.createPercentageCoupon(promoCode.discountPercent, code);
    const checkoutUrl = await stripeService.createCheckoutSession({
      user,
      tier: promoCode.tier as 'basic' | 'pro' | 'premium',
      successUrl: APP_DEEP_LINK_SUCCESS,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
    });

    await this.redemptionRepo.save(
      this.redemptionRepo.create({ promoCode, user, redeemedAt: new Date(), stripeCouponId: couponId })
    );
    await this.promoRepo.increment({ id: promoCode.id }, 'usedCount', 1);

    return { checkoutUrl, bypassStripe: false, tier: promoCode.tier };
  }

  // ─── Webhook sync ────────────────────────────────────────────────────────────

  async upsertSubscription(
    userId: string,
    data: {
      tier: SubscriptionTier;
      status: SubscriptionStatus;
      externalRef?: string;
      externalProvider?: string;
      mrrCents?: number | null;
      expiresAt?: Date | null;
      notes?: string;
    }
  ): Promise<void> {
    let sub = await this.subRepo.findOne({ where: { user: { id: userId } } });

    if (!sub) {
      sub = this.subRepo.create({
        user: { id: userId } as User,
        currency: 'EUR',
      });
    }

    sub.tier = data.tier;
    sub.status = data.status;
    if (data.externalRef !== undefined) sub.externalRef = data.externalRef;
    if (data.externalProvider !== undefined) sub.externalProvider = data.externalProvider;
    if (data.mrrCents !== undefined) sub.mrrCents = data.mrrCents;
    if (data.expiresAt !== undefined) sub.expiresAt = data.expiresAt;
    if (data.notes !== undefined) sub.notes = data.notes ?? null;

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
      .set({ tier: 'basic', status: 'active', expiresAt: null })
      .where('status = :status', { status: 'trialing' })
      .andWhere('expiresAt < :now', { now })
      .execute();

    return result.affected ?? 0;
  }

  async getPastDueSubscriptions(gracePeriodDays = GRACE_PERIOD_DAYS): Promise<UserSubscription[]> {
    const cutoff = addDays(new Date(), -gracePeriodDays);
    return this.subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .where('s.status = :status', { status: 'past_due' })
      .andWhere('s.updatedAt < :cutoff', { cutoff })
      .getMany();
  }

  async downgradeToBasic(userId: string): Promise<void> {
    await this.subRepo.update(
      { user: { id: userId } },
      { tier: 'basic', status: 'active' }
    );
  }

  async sendTrialReminderEmail(user: User, daysLeft: number): Promise<void> {
    const subject = daysLeft === 1
      ? 'Your Spiriment free trial ends tomorrow'
      : `Your Spiriment free trial ends in ${daysLeft} days`;

    const html = `
      <p>Hi ${user.firstName ?? 'there'},</p>
      <p>Your 2-week free trial of Spiriment Premium ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
      <p>After that, you'll automatically move to the <strong>Basic plan (€3/month)</strong> unless you choose a plan.</p>
      <p>Open the app to pick the plan that works for you.</p>
      <p>— The Spiriment Team</p>
    `;

    await this.emailService.sendEmail({ to: user.email, subject, compiledContent: html });
  }

  async sendGracePeriodDowngradeEmail(user: User): Promise<void> {
    const html = `
      <p>Hi ${user.firstName ?? 'there'},</p>
      <p>We were unable to process your payment after ${GRACE_PERIOD_DAYS} days. Your account has been moved to the <strong>Basic plan</strong>.</p>
      <p>Open the app and update your payment method to restore your previous plan.</p>
      <p>— The Spiriment Team</p>
    `;

    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Your Spiriment subscription has been downgraded',
      compiledContent: html,
    });
  }
}
