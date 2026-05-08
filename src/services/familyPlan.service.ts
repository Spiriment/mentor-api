import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { FamilyPlan } from '@/database/entities/familyPlan.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { UserSubscription, SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';
import { stripeService } from './stripe.service';
import { v4 as uuidv4 } from 'uuid';

const APP_DEEP_LINK_SUCCESS = process.env.APP_DEEP_LINK ?? 'spiriment://subscription/success';
const APP_DEEP_LINK_CANCEL = process.env.APP_DEEP_LINK ?? 'spiriment://subscription/cancel';

const TIER_PRICE_EUR: Record<string, number> = { basic: 3, pro: 5, premium: 7.5 };

function calcAgeDiscount(birthday: Date | string | null | undefined): number {
  if (!birthday) return 0;
  const dob = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  if (age >= 10 && age <= 14) return 50;
  if (age >= 15 && age <= 18) return 30;
  return 0;
}

function effectivePrice(tier: string, discountPercent: number): number {
  const base = TIER_PRICE_EUR[tier] ?? 0;
  return Math.round(base * (1 - discountPercent / 100) * 100) / 100;
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

    const memberUser = await this.userRepo.findOne({ where: { id: memberUserId } });
    if (!memberUser) throw new AppError('User not found', 404);

    const alreadyMember = await this.memberRepo.findOne({ where: { userId: memberUserId } });
    if (alreadyMember) throw new AppError('This user is already part of a family plan', 409);

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
      successUrl: `${APP_DEEP_LINK_SUCCESS}?familyMember=${memberUserId}`,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
    });

    // Create member row — stripeSubscriptionId filled in by webhook on payment
    const member = this.memberRepo.create({
      id: uuidv4(),
      familyPlanId: planId,
      userId: memberUserId,
      tier,
      ageDiscountPercent: discountPercent,
      isParent: false,
      stripeSubscriptionId: null,
    });
    await this.memberRepo.save(member);

    return { checkoutUrl, discountPercent, effectivePriceEur: price };
  }

  // ─── Remove member ────────────────────────────────────────────────────────────

  async removeMember(planId: string, parentUser: User, memberUserId: string): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (plan.parentUserId !== parentUser.id) throw new AppError('Only the plan owner can remove members', 403);
    if (memberUserId === parentUser.id) throw new AppError('Cannot remove the plan owner', 400);

    const member = await this.memberRepo.findOne({ where: { familyPlanId: planId, userId: memberUserId } });
    if (!member) throw new AppError('Member not found in this plan', 404);

    if (member.stripeSubscriptionId) {
      await stripeService.cancelSubscription(member.stripeSubscriptionId);
    }

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
    });

    member.tier = newTier;
    member.stripeSubscriptionId = null;
    await this.memberRepo.save(member);

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
      where: { familyPlanId: plan.id },
      relations: ['user'],
    });

    const memberList = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      firstName: m.user?.firstName ?? '',
      lastName: m.user?.lastName ?? '',
      email: m.user?.email ?? '',
      tier: m.tier,
      ageDiscountPercent: m.ageDiscountPercent,
      monthlyPriceEur: effectivePrice(m.tier, m.ageDiscountPercent),
      isParent: m.isParent,
    }));

    const totalMonthlyEur = memberList.reduce((sum, m) => sum + m.monthlyPriceEur, 0);

    return {
      planId: plan.id,
      planName: plan.name,
      isOwner: plan.parentUserId === userId,
      members: memberList,
      totalMonthlyEur: Math.round(totalMonthlyEur * 100) / 100,
    };
  }

  // ─── Webhook sync ─────────────────────────────────────────────────────────────

  async syncMemberSubscription(memberUserId: string, stripeSubscriptionId: string, status: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { userId: memberUserId } });
    if (!member) return;

    member.stripeSubscriptionId = stripeSubscriptionId;
    await this.memberRepo.save(member);

    // Also upsert the UserSubscription row for the member
    let sub = await this.subRepo.findOne({ where: { user: { id: memberUserId } } });
    if (!sub) {
      sub = this.subRepo.create({ user: { id: memberUserId } as User, currency: 'EUR' });
    }
    sub.tier = member.tier;
    sub.status = status === 'canceled' ? 'canceled' : 'active';
    sub.externalRef = stripeSubscriptionId;
    sub.externalProvider = 'stripe_family';
    await this.subRepo.save(sub);
  }
}

export const familyPlanService = new FamilyPlanService();
