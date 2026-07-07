import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { FamilyPlan } from '@/database/entities/familyPlan.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { UserSubscription, SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';
import { stripeService } from './stripe.service';
import { getYouthDiscountPercent } from '@/common/constants/userAge';
import { EmailService } from '@/core/email.service';
import { v4 as uuidv4 } from 'uuid';
import { IsNull, In } from 'typeorm';
import { APP_DEEP_LINK_CANCEL, APP_DEEP_LINK_SUCCESS } from '@/common/constants/appDeepLinks';
import { TIER_ANNUAL_PRICE_EUR, TIER_PRICE_EUR } from '@/common/constants/subscriptionPricing';

const TIER_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

let emailServiceInstance: EmailService | null = null;
function getEmailService(): EmailService {
  if (!emailServiceInstance) emailServiceInstance = new EmailService(null);
  return emailServiceInstance;
}

function calcAgeDiscount(birthday: Date | string | null | undefined): number {
  return getYouthDiscountPercent(birthday) ?? 0;
}

function effectivePrice(
  tier: string,
  discountPercent: number,
  interval: 'monthly' | 'annual' = 'monthly',
): number {
  const base =
    interval === 'annual'
      ? (TIER_ANNUAL_PRICE_EUR[tier as keyof typeof TIER_ANNUAL_PRICE_EUR] ?? 0)
      : (TIER_PRICE_EUR[tier as keyof typeof TIER_PRICE_EUR] ?? 0);
  return Math.round(base * (1 - discountPercent / 100) * 100) / 100;
}

function monthlyEquivalentPrice(
  tier: string,
  discountPercent: number,
  interval: 'monthly' | 'annual',
): number {
  const billed = effectivePrice(tier, discountPercent, interval);
  if (interval === 'annual') {
    return Math.round((billed / 12) * 100) / 100;
  }
  return billed;
}

function daysReadThisMonth(monthlyStreakData?: { [key: string]: number[] } | null): number {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return monthlyStreakData?.[key]?.length ?? 0;
}

function formatLastActive(lastActiveAt?: Date | null): string | null {
  if (!lastActiveAt) return null;
  return lastActiveAt.toISOString();
}

export class FamilyPlanService {
  private get planRepo() { return AppDataSource.getRepository(FamilyPlan); }
  private get memberRepo() { return AppDataSource.getRepository(FamilyMember); }
  private get userRepo() { return AppDataSource.getRepository(User); }
  private get subRepo() { return AppDataSource.getRepository(UserSubscription); }

  // ─── Create ───────────────────────────────────────────────────────────────────

  async createFamilyPlan(parentUser: User, name: string): Promise<FamilyPlan> {
    const existing = await this.memberRepo.findOne({ where: { userId: parentUser.id } });
    if (existing) throw new AppError('You are already part of a family plan', 409);

    const plan = this.planRepo.create({
      id: uuidv4(),
      name,
      status: 'active',
      parentUserId: parentUser.id,
    });
    await this.planRepo.save(plan);

    // Add parent as first member (no age discount, their own tier from existing subscription)
    const parentSub = await this.subRepo.findOne({ where: { user: { id: parentUser.id } } });
    const parentTier: SubscriptionTier = parentSub?.tier ?? 'basic';

    const parentMember = this.memberRepo.create({
      id: uuidv4(),
      familyPlanId: plan.id,
      userId: parentUser.id,
      tier: parentTier,
      ageDiscountPercent: 0,
      isParent: true,
      stripeSubscriptionId: parentSub?.externalRef ?? null,
    });
    await this.memberRepo.save(parentMember);

    return plan;
  }

  // ─── Add member ───────────────────────────────────────────────────────────────

  async addMember(
    planId: string,
    parentUser: User,
    memberUserId: string,
    tier: SubscriptionTier,
    interval: 'monthly' | 'annual' = 'monthly',
  ): Promise<{
    checkoutUrl: string;
    discountPercent: number;
    effectivePriceEur: number;
    billingInterval: 'monthly' | 'annual';
  }> {
    const plan = await this.planRepo.findOne({ where: { id: planId, status: 'active' } });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (plan.parentUserId !== parentUser.id) throw new AppError('Only the plan owner can add members', 403);

    // Accept either a UUID or an email address
    const isEmail = memberUserId.includes('@');
    const memberUser = await this.userRepo.findOne({
      where: isEmail ? { email: memberUserId } : { id: memberUserId },
    });
    if (!memberUser) throw new AppError('No account found with that email. Ask them to sign up first.', 404);

    const alreadyMember = await this.memberRepo.findOne({ where: { userId: memberUser.id } });
    if (alreadyMember) {
      if (alreadyMember.removedAt) {
        throw new AppError('This member is pending removal. Wait until their billing period ends.', 409);
      }
      throw new AppError('This user is already part of a family plan', 409);
    }

    const memberSub = await this.subRepo.findOne({ where: { user: { id: memberUser.id } } });
    if (
      memberSub &&
      ['active', 'past_due', 'trialing'].includes(memberSub.status) &&
      ['basic', 'pro', 'premium'].includes(memberSub.tier)
    ) {
      throw new AppError(
        'This user already has an active subscription. They must cancel it before joining a family plan.',
        409,
      );
    }

    const discountPercent = calcAgeDiscount(memberUser.birthday);
    const price = effectivePrice(tier, discountPercent, interval);

    let couponId: string | undefined;
    if (discountPercent > 0) {
      couponId = await stripeService.getOrCreatePercentageCoupon(
        discountPercent,
        `family-age-${memberUser.id}`,
      );
    }

    const checkoutUrl = await stripeService.createCheckoutSession({
      user: parentUser,
      tier: tier as 'basic' | 'pro' | 'premium',
      interval,
      successUrl: `${APP_DEEP_LINK_SUCCESS}?familyMember=${memberUser.id}`,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
      subscriptionMetadata: {
        familyMemberUserId: memberUser.id,
        familyPlanId: planId,
        familyMemberAgeDiscount: String(discountPercent),
      },
    });

    return { checkoutUrl, discountPercent, effectivePriceEur: price, billingInterval: interval };
  }

  // ─── Remove member ────────────────────────────────────────────────────────────

  async removeMember(planId: string, parentUser: User, memberUserId: string): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (plan.parentUserId !== parentUser.id) throw new AppError('Only the plan owner can remove members', 403);
    if (memberUserId === parentUser.id) throw new AppError('Cannot remove the plan owner', 400);

    const member = await this.memberRepo.findOne({
      where: { familyPlanId: planId, userId: memberUserId, removedAt: IsNull() },
    });
    if (!member) throw new AppError('Member not found in this plan', 404);

    if (member.stripeSubscriptionId) {
      member.removedAt = new Date();
      await this.memberRepo.save(member);
      await stripeService.cancelSubscriptionAtPeriodEnd(member.stripeSubscriptionId);
      return;
    }

    await this.downgradeMemberSubscription(memberUserId);
    await this.memberRepo.remove(member);
  }

  // ─── Change member tier ───────────────────────────────────────────────────────

  async changeMemberTier(
    planId: string,
    parentUser: User,
    memberUserId: string,
    newTier: SubscriptionTier,
    interval: 'monthly' | 'annual' = 'monthly',
  ): Promise<{ checkoutUrl: string; effectivePriceEur: number; billingInterval: 'monthly' | 'annual' }> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (plan.parentUserId !== parentUser.id) throw new AppError('Only the plan owner can change tiers', 403);

    const member = await this.memberRepo.findOne({ where: { familyPlanId: planId, userId: memberUserId } });
    if (!member) throw new AppError('Member not found in this plan', 404);

    let couponId: string | undefined;
    if (member.ageDiscountPercent > 0) {
      couponId = await stripeService.getOrCreatePercentageCoupon(
        member.ageDiscountPercent,
        `family-age-${memberUserId}`,
      );
    }

    const checkoutUrl = await stripeService.createCheckoutSession({
      user: parentUser,
      tier: newTier as 'basic' | 'pro' | 'premium',
      interval,
      successUrl: `${APP_DEEP_LINK_SUCCESS}?familyMember=${memberUserId}`,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
      subscriptionMetadata: {
        familyMemberUserId: memberUserId,
        familyPlanId: planId,
        familyMemberAgeDiscount: String(member.ageDiscountPercent),
      },
    });

    return {
      checkoutUrl,
      effectivePriceEur: effectivePrice(newTier, member.ageDiscountPercent, interval),
      billingInterval: interval,
    };
  }

  // ─── Overview ─────────────────────────────────────────────────────────────────

  async getFamilyOverview(userId: string) {
    const membership = await this.memberRepo.findOne({
      where: { userId },
      relations: ['familyPlan', 'familyPlan.parent'],
    });
    if (!membership) throw new AppError('You are not part of a family plan', 404);

    const plan = membership.familyPlan;
    const members = await this.memberRepo.find({
      where: { familyPlanId: plan.id, removedAt: IsNull() },
      relations: ['user'],
    });

    const memberUserIds = members.map((m) => m.userId);
    const subs = memberUserIds.length
      ? await this.subRepo.find({ where: { userId: In(memberUserIds) } })
      : [];
    const subByUserId = new Map(subs.map((s) => [s.userId, s]));

    const isOwner = plan.parentUserId === userId;
    const parent = plan.parent;

    const memberList = members.map((m) => {
      const sub = subByUserId.get(m.userId);
      const billingInterval = sub?.billingInterval ?? 'monthly';
      const billedPriceEur = effectivePrice(m.tier, m.ageDiscountPercent, billingInterval);
      const monthlyPriceEur = monthlyEquivalentPrice(m.tier, m.ageDiscountPercent, billingInterval);
      const base = {
        id: m.id,
        userId: m.userId,
        firstName: m.user?.firstName ?? '',
        lastName: m.user?.lastName ?? '',
        email: m.user?.email ?? '',
        tier: m.tier,
        ageDiscountPercent: m.ageDiscountPercent,
        billingInterval,
        billedPriceEur,
        monthlyPriceEur,
        isParent: m.isParent,
        paymentStatus: m.stripeSubscriptionId ? 'active' as const : 'pending' as const,
        ...(isOwner
          ? {
              activity: {
                currentStreak: m.user?.currentStreak ?? 0,
                longestStreak: m.user?.longestStreak ?? 0,
                daysReadThisMonth: daysReadThisMonth(m.user?.monthlyStreakData),
                lastActiveAt: formatLastActive(m.user?.lastActiveAt),
              },
            }
          : {}),
      };
      return base;
    });

    const totalMonthlyEur = memberList.reduce((sum, m) => sum + m.monthlyPriceEur, 0);

    const familySummary = isOwner
      ? {
          totalMembers: memberList.length,
          combinedStreakDays: memberList.reduce(
            (sum, m) => sum + (m.activity?.currentStreak ?? 0),
            0,
          ),
          totalDaysReadThisMonth: memberList.reduce(
            (sum, m) => sum + (m.activity?.daysReadThisMonth ?? 0),
            0,
          ),
        }
      : undefined;

    return {
      planId: plan.id,
      planName: plan.name,
      isOwner,
      ownerName: parent
        ? `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim()
        : '',
      members: memberList,
      totalMonthlyEur: Math.round(totalMonthlyEur * 100) / 100,
      ...(familySummary ? { familySummary } : {}),
    };
  }

  // ─── Webhook sync ─────────────────────────────────────────────────────────────

  private async notifyMemberAdded(
    plan: FamilyPlan,
    parentUser: User,
    memberUser: User,
    tier: SubscriptionTier,
    ageDiscountPercent: number,
  ): Promise<void> {
    const ownerName = `${parentUser.firstName ?? ''} ${parentUser.lastName ?? ''}`.trim() || parentUser.email;
    const memberName = `${memberUser.firstName ?? ''} ${memberUser.lastName ?? ''}`.trim() || 'there';

    try {
      await getEmailService().sendFamilyPlanWelcomeEmail({
        to: memberUser.email,
        memberName,
        ownerName,
        planName: plan.name,
        tierLabel: TIER_LABELS[tier] ?? tier,
        ageDiscountPercent,
      });
    } catch {
      // Non-blocking — member is still added if email fails
    }
  }

  async findMemberByStripeSubscriptionId(stripeSubscriptionId: string): Promise<FamilyMember | null> {
    return this.memberRepo.findOne({ where: { stripeSubscriptionId } });
  }

  async findActiveMemberByUserId(userId: string): Promise<FamilyMember | null> {
    return this.memberRepo.findOne({ where: { userId, removedAt: IsNull() } });
  }

  async ensureMemberFromCheckout(params: {
    planId: string;
    memberUserId: string;
    tier: SubscriptionTier;
    ageDiscountPercent: number;
  }): Promise<FamilyMember> {
    const existing = await this.memberRepo.findOne({
      where: { userId: params.memberUserId },
      relations: ['user', 'familyPlan', 'familyPlan.parent'],
    });
    if (existing) {
      if (existing.removedAt) {
        throw new AppError('This member is pending removal', 409);
      }
      existing.tier = params.tier;
      existing.ageDiscountPercent = params.ageDiscountPercent;
      await this.memberRepo.save(existing);
      return existing;
    }

    const plan = await this.planRepo.findOne({
      where: { id: params.planId, status: 'active' },
      relations: ['parent'],
    });
    if (!plan) throw new AppError('Family plan not found', 404);

    const memberUser = await this.userRepo.findOne({ where: { id: params.memberUserId } });
    if (!memberUser) throw new AppError('Member user not found', 404);

    const member = this.memberRepo.create({
      id: uuidv4(),
      familyPlanId: params.planId,
      userId: params.memberUserId,
      tier: params.tier,
      ageDiscountPercent: params.ageDiscountPercent,
      isParent: false,
      stripeSubscriptionId: null,
    });
    await this.memberRepo.save(member);

    await this.notifyMemberAdded(plan, plan.parent, memberUser, params.tier, params.ageDiscountPercent);

    return member;
  }

  async syncMemberSubscription(
    memberUserId: string,
    stripeSubscriptionId: string,
    status: string,
    options?: {
      sendActivationEmail?: boolean;
      tier?: SubscriptionTier;
      mrrCents?: number;
      billingInterval?: 'monthly' | 'annual';
      expiresAt?: Date | null;
    },
  ): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { userId: memberUserId },
      relations: ['user', 'familyPlan', 'familyPlan.parent'],
    });

    if (status === 'canceled') {
      await this.downgradeMemberSubscription(memberUserId, stripeSubscriptionId);
      if (member) {
        member.stripeSubscriptionId = null;
        await this.memberRepo.save(member);
      }
      if (member?.removedAt) {
        await this.memberRepo.remove(member);
      }
      return;
    }

    if (!member) {
      throw new AppError(
        `Family member record not found for user ${memberUserId}`,
        404,
      );
    }

    if (options?.tier) {
      member.tier = options.tier;
    }

    const previousStripeSubId = member.stripeSubscriptionId;
    member.stripeSubscriptionId = stripeSubscriptionId;
    await this.memberRepo.save(member);

    if (
      previousStripeSubId &&
      previousStripeSubId !== stripeSubscriptionId &&
      status === 'active'
    ) {
      try {
        await stripeService.cancelSubscription(previousStripeSubId);
      } catch {
        // Old subscription may already be cancelled; non-blocking
      }
    }

    let sub = await this.subRepo.findOne({ where: { user: { id: memberUserId } } });
    if (!sub) {
      sub = this.subRepo.create({ user: { id: memberUserId } as User, currency: 'EUR' });
    }
    const previousStatus = sub.status;
    sub.tier = member.tier;
    sub.status = status === 'past_due' ? 'past_due' : 'active';
    sub.externalRef = stripeSubscriptionId;
    sub.externalProvider = member.isParent ? 'stripe' : 'stripe_family';
    if (options?.mrrCents !== undefined) sub.mrrCents = options.mrrCents;
    if (options?.billingInterval !== undefined) sub.billingInterval = options.billingInterval;
    if (options?.expiresAt !== undefined) sub.expiresAt = options.expiresAt;
    if (status === 'past_due' && previousStatus !== 'past_due') {
      sub.pastDueAt = new Date();
    } else if (status === 'active') {
      sub.pastDueAt = null;
    }
    await this.subRepo.save(sub);

    if (options?.sendActivationEmail && status === 'active' && member.user) {
      await this.notifyMemberActivated(member);
    }
  }

  private async downgradeMemberSubscription(
    memberUserId: string,
    stripeSubscriptionId?: string | null,
  ): Promise<void> {
    let sub = await this.subRepo.findOne({ where: { user: { id: memberUserId } } });
    if (!sub && stripeSubscriptionId) {
      sub = await this.subRepo.findOne({ where: { externalRef: stripeSubscriptionId } });
    }
    if (!sub) return;

    sub.tier = 'free';
    sub.status = 'active';
    sub.externalRef = null;
    sub.externalProvider = null;
    sub.mrrCents = null;
    sub.expiresAt = null;
    sub.pastDueAt = null;
    sub.billingInterval = null;
    await this.subRepo.save(sub);
  }

  // ─── Admin operations ─────────────────────────────────────────────────────────

  async adminRemoveMember(planId: string, memberUserId: string): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { familyPlanId: planId, userId: memberUserId },
    });
    if (!member) throw new AppError('Member not found in this plan', 404);
    if (member.isParent) {
      throw new AppError('Cannot remove the plan owner via admin — deactivate the plan instead', 400);
    }

    if (member.stripeSubscriptionId) {
      await stripeService.cancelSubscription(member.stripeSubscriptionId);
    }
    await this.downgradeMemberSubscription(memberUserId, member.stripeSubscriptionId);
    await this.memberRepo.remove(member);
  }

  async adminChangeMemberTier(
    planId: string,
    memberUserId: string,
    newTier: SubscriptionTier,
    interval: 'monthly' | 'annual' = 'monthly',
  ): Promise<{ checkoutUrl: string; effectivePriceEur: number; billingInterval: 'monthly' | 'annual' }> {
    const plan = await this.planRepo.findOne({
      where: { id: planId },
      relations: ['parent'],
    });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (!plan.parent) throw new AppError('Family plan parent not found', 500);

    return this.changeMemberTier(planId, plan.parent, memberUserId, newTier, interval);
  }

  async adminDeactivatePlan(planId: string): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);

    const members = await this.memberRepo.find({ where: { familyPlanId: planId } });
    for (const member of members) {
      if (member.stripeSubscriptionId) {
        await stripeService.cancelSubscription(member.stripeSubscriptionId).catch(() => {});
      }
      if (!member.isParent) {
        await this.downgradeMemberSubscription(member.userId, member.stripeSubscriptionId);
      }
    }

    plan.status = 'inactive';
    await this.planRepo.save(plan);
  }

  private async notifyMemberActivated(member: FamilyMember): Promise<void> {
    const memberUser = member.user;
    const plan = member.familyPlan;
    const parent = plan?.parent;
    if (!memberUser || !plan) return;

    const ownerName = parent
      ? `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim() || parent.email
      : 'your family plan owner';
    const memberName = `${memberUser.firstName ?? ''} ${memberUser.lastName ?? ''}`.trim() || 'there';

    try {
      await getEmailService().sendFamilyPlanActivatedEmail({
        to: memberUser.email,
        memberName,
        ownerName,
        planName: plan.name,
        tierLabel: TIER_LABELS[member.tier] ?? member.tier,
      });
    } catch {
      // Non-blocking
    }
  }
}

export const familyPlanService = new FamilyPlanService();
