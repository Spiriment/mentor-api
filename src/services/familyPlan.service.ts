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
import { IsNull } from 'typeorm';
import { APP_DEEP_LINK_CANCEL, APP_DEEP_LINK_SUCCESS } from '@/common/constants/appDeepLinks';

const TIER_PRICE_EUR: Record<string, number> = { basic: 3, pro: 5, premium: 7.5 };

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

function effectivePrice(tier: string, discountPercent: number): number {
  const base = TIER_PRICE_EUR[tier] ?? 0;
  return Math.round(base * (1 - discountPercent / 100) * 100) / 100;
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
  ): Promise<{ checkoutUrl: string; discountPercent: number; effectivePriceEur: number }> {
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

    const discountPercent = calcAgeDiscount(memberUser.birthday);
    const price = effectivePrice(tier, discountPercent);

    // Create Stripe subscription billed to parent's customer
    const parentCustomerId = await stripeService.getOrCreateCustomer(parentUser);

    let couponId: string | undefined;
    if (discountPercent > 0) {
      couponId = await stripeService.createPercentageCoupon(
        discountPercent,
        `family-age-${memberUser.id.slice(0, 8)}`,
      );
    }

    const checkoutUrl = await stripeService.createCheckoutSession({
      user: parentUser,
      tier: tier as 'basic' | 'pro' | 'premium',
      successUrl: `${APP_DEEP_LINK_SUCCESS}?familyMember=${memberUser.id}`,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
      subscriptionMetadata: {
        familyMemberUserId: memberUser.id,
        familyPlanId: planId,
        familyMemberAgeDiscount: String(discountPercent),
      },
    });

    return { checkoutUrl, discountPercent, effectivePriceEur: price };
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
  ): Promise<{ checkoutUrl: string; effectivePriceEur: number }> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (plan.parentUserId !== parentUser.id) throw new AppError('Only the plan owner can change tiers', 403);

    const member = await this.memberRepo.findOne({ where: { familyPlanId: planId, userId: memberUserId } });
    if (!member) throw new AppError('Member not found in this plan', 404);

    // Cancel existing subscription and create a new one at the new tier
    if (member.stripeSubscriptionId) {
      await stripeService.cancelSubscription(member.stripeSubscriptionId);
    }

    let couponId: string | undefined;
    if (member.ageDiscountPercent > 0) {
      couponId = await stripeService.createPercentageCoupon(
        member.ageDiscountPercent,
        `family-age-${memberUserId.slice(0, 8)}-${newTier}`,
      );
    }

    const checkoutUrl = await stripeService.createCheckoutSession({
      user: parentUser,
      tier: newTier as 'basic' | 'pro' | 'premium',
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
      effectivePriceEur: effectivePrice(newTier, member.ageDiscountPercent),
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

    const isOwner = plan.parentUserId === userId;
    const parent = plan.parent;

    const memberList = members.map((m) => {
      const base = {
        id: m.id,
        userId: m.userId,
        firstName: m.user?.firstName ?? '',
        lastName: m.user?.lastName ?? '',
        email: m.user?.email ?? '',
        tier: m.tier,
        ageDiscountPercent: m.ageDiscountPercent,
        monthlyPriceEur: effectivePrice(m.tier, m.ageDiscountPercent),
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
    options?: { sendActivationEmail?: boolean; tier?: SubscriptionTier },
  ): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: { userId: memberUserId },
      relations: ['user', 'familyPlan', 'familyPlan.parent'],
    });

    if (status === 'canceled') {
      await this.downgradeMemberSubscription(memberUserId, stripeSubscriptionId);
      if (member?.removedAt) {
        await this.memberRepo.remove(member);
      }
      return;
    }

    if (!member) return;

    if (options?.tier) {
      member.tier = options.tier;
    }

    member.stripeSubscriptionId = stripeSubscriptionId;
    await this.memberRepo.save(member);

    let sub = await this.subRepo.findOne({ where: { user: { id: memberUserId } } });
    if (!sub) {
      sub = this.subRepo.create({ user: { id: memberUserId } as User, currency: 'EUR' });
    }
    const previousStatus = sub.status;
    sub.tier = member.tier;
    sub.status = status === 'past_due' ? 'past_due' : 'active';
    sub.externalRef = stripeSubscriptionId;
    sub.externalProvider = 'stripe_family';
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
    sub.mrrCents = 0;
    sub.expiresAt = null;
    await this.subRepo.save(sub);
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
