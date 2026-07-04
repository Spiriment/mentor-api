import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import {
  OrgPlan,
  type OrgPlanType,
} from '@/database/entities/orgPlan.entity';
import { FamilyPlan } from '@/database/entities/familyPlan.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { UserSubscription, SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';
import { adminAuditService } from './adminAudit.service';
import { stripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';
import { EmailService } from '@/core/email.service';
import { APP_DEEP_LINK_CANCEL, APP_DEEP_LINK_SUCCESS } from '@/common/constants/appDeepLinks';

const CHURCH_DISCOUNT_PERCENT = 20;
const CHURCH_BULK_DISCOUNT_PERCENT = 25; // 20% + 5% for 50+ members

export class AdminOrgPlanService {
  private serialize(p: OrgPlan) {
    return {
      id: p.id,
      planType: p.planType,
      name: p.name,
      status: p.status,
      totalSeats: p.totalSeats,
      usedSeats: p.usedSeats,
      billingAdminUserId: p.billingAdminUserId ?? null,
      billingAdminName: p.billingAdmin
        ? `${p.billingAdmin.firstName} ${p.billingAdmin.lastName}`
        : null,
      metadata: p.metadata ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async list(planType: OrgPlanType, page = 1, limit = 50) {
    const repo = AppDataSource.getRepository(OrgPlan);
    const [rows, total] = await repo.findAndCount({
      where: { planType, status: 'active' },
      relations: ['billingAdmin'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });
    return {
      data: rows.map((p) => this.serialize(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(
    planType: OrgPlanType,
    input: {
      name: string;
      totalSeats: number;
      usedSeats?: number;
      billingAdminUserId?: string | null;
      metadata?: Record<string, unknown>;
    },
    adminUserId: string,
    ip?: string
  ) {
    if (input.billingAdminUserId) {
      const u = await AppDataSource.getRepository(User).findOne({
        where: { id: input.billingAdminUserId },
      });
      if (!u) {
        throw new AppError('Billing admin user not found', 400);
      }
    }

    const repo = AppDataSource.getRepository(OrgPlan);
    const row = repo.create({
      planType,
      name: input.name,
      status: 'active',
      totalSeats: input.totalSeats,
      usedSeats: input.usedSeats ?? 0,
      billingAdminUserId: input.billingAdminUserId ?? null,
      metadata: input.metadata ?? null,
    });
    const saved = await repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.create',
      targetType: 'org_plan',
      targetId: saved.id,
      metadata: { planType },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async update(
    planType: OrgPlanType,
    planId: string,
    input: {
      name?: string;
      totalSeats?: number;
      usedSeats?: number;
      billingAdminUserId?: string | null;
      metadata?: Record<string, unknown> | null;
      status?: 'active' | 'inactive';
    },
    adminUserId: string,
    ip?: string
  ) {
    if (!isUuid(planId)) {
      throw new AppError('Invalid plan id', 400);
    }

    const repo = AppDataSource.getRepository(OrgPlan);
    const row = await repo.findOne({ where: { id: planId, planType } });
    if (!row) {
      throw new AppError('Plan not found', 404);
    }

    if (input.billingAdminUserId) {
      const u = await AppDataSource.getRepository(User).findOne({
        where: { id: input.billingAdminUserId },
      });
      if (!u) {
        throw new AppError('Billing admin user not found', 400);
      }
    }

    if (input.name !== undefined) {
      row.name = input.name;
    }
    if (input.totalSeats !== undefined) {
      row.totalSeats = input.totalSeats;
    }
    if (input.usedSeats !== undefined) {
      row.usedSeats = input.usedSeats;
    }
    if (input.billingAdminUserId !== undefined) {
      row.billingAdminUserId = input.billingAdminUserId;
    }
    if (input.metadata !== undefined) {
      row.metadata = input.metadata;
    }
    if (input.status !== undefined) {
      row.status = input.status;
    }

    const saved = await repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.update',
      targetType: 'org_plan',
      targetId: planId,
      metadata: { planType, patch: Object.keys(input) },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async deactivate(
    planType: OrgPlanType,
    planId: string,
    adminUserId: string,
    ip?: string
  ) {
    return this.update(
      planType,
      planId,
      { status: 'inactive' },
      adminUserId,
      ip
    );
  }

  async getMembers(planId: string) {
    if (!isUuid(planId)) {
      throw new AppError('Invalid plan id', 400);
    }
    const users = await AppDataSource.getRepository(User).find({
      where: { orgPlanId: planId },
      select: [
        'id',
        'firstName',
        'lastName',
        'email',
        'createdAt',
        'isActive',
        'role',
      ],
      order: { createdAt: 'DESC' },
    });
    return { data: users };
  }

  async getReport(planId: string) {
    if (!isUuid(planId)) {
      throw new AppError('Invalid plan id', 400);
    }

    const users = await AppDataSource.getRepository(User).find({
      where: { orgPlanId: planId },
      select: [
        'id',
        'firstName',
        'lastName',
        'currentStreak',
        'longestStreak',
        'monthlyStreakData',
      ],
    });

    if (users.length === 0) {
      return {
        totalSessions: 0,
        avgStreak: 0,
        totalMembers: 0,
        activityChart: [],
        topPerformers: [],
      };
    }

    const totalMembers = users.length;
    const totalCurrentStreak = users.reduce(
      (acc, u) => acc + (u.currentStreak || 0),
      0
    );
    const avgStreak = Math.round(totalCurrentStreak / totalMembers);

    // Mock session aggregation for the report
    const totalSessions = users.reduce(
      (acc, u) => acc + (u.longestStreak || 0) * 2,
      0
    );

    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}`;
    
    // Group activity by Day of Week (0=Sun, 1=Mon, ..., 6=Sat)
    const dowActivity = new Array(7).fill(0);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    users.forEach((u) => {
      const days = u.monthlyStreakData?.[monthKey] || [];
      days.forEach((d) => {
        if (d >= 1 && d <= 31) {
          // Calculate day of week for this specific day in the current month
          const date = new Date(today.getFullYear(), today.getMonth(), d);
          const dow = date.getDay();
          dowActivity[dow]++;
        }
      });
    });

    const activityChart = dayNames.map((name, index) => ({
      day: name,
      activeUsers: dowActivity[index],
    }));

    const topPerformers = users
      .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))
      .slice(0, 3)
      .map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim() || 'Anonymous',
        streak: u.currentStreak,
      }));

    return {
      totalSessions: Math.round(totalSessions),
      avgStreak,
      totalMembers,
      activityChart,
      topPerformers,
    };
  }

  // ─── Member assignment ────────────────────────────────────────────────────────

  async assignMember(
    planId: string,
    userId: string,
    tier: 'basic' | 'pro' | 'premium',
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);
    if (!isUuid(userId)) throw new AppError('Invalid user id', 400);

    const planRepo = AppDataSource.getRepository(OrgPlan);
    const userRepo = AppDataSource.getRepository(User);

    const plan = await planRepo.findOne({ where: { id: planId, status: 'active' } });
    if (!plan) throw new AppError('Plan not found or inactive', 404);
    if (plan.planType !== 'church') throw new AppError('Member assignment is only supported for church plans', 400);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.orgPlanId) throw new AppError('User is already assigned to an org plan', 409);

    // Determine discount: 25% for 50+ member churches, 20% otherwise
    const discountPercent = plan.usedSeats >= 50 ? CHURCH_BULK_DISCOUNT_PERCENT : CHURCH_DISCOUNT_PERCENT;

    // Create a Stripe coupon and checkout session with the church discount
    const couponLabel = `church-${plan.id.slice(0, 8)}`;
    const couponId = await stripeService.createPercentageCoupon(discountPercent, couponLabel);

    const checkoutUrl = await stripeService.createCheckoutSession({
      user,
      tier,
      successUrl: APP_DEEP_LINK_SUCCESS,
      cancelUrl: APP_DEEP_LINK_CANCEL,
      couponId,
    });

    // Assign user to plan immediately — subscription row updates via webhook on payment
    user.orgPlanId = planId;
    await userRepo.save(user);

    // Increment used seats
    plan.usedSeats = plan.usedSeats + 1;
    await planRepo.save(plan);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.assign_member',
      targetType: 'user',
      targetId: userId,
      metadata: { planId, tier, discountPercent },
      ip: ip ?? null,
    });

    return { checkoutUrl, discountPercent, tier };
  }

  async removeMember(
    planId: string,
    userId: string,
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);
    if (!isUuid(userId)) throw new AppError('Invalid user id', 400);

    const planRepo = AppDataSource.getRepository(OrgPlan);
    const userRepo = AppDataSource.getRepository(User);

    const plan = await planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Plan not found', 404);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.orgPlanId !== planId) throw new AppError('User is not a member of this plan', 400);

    user.orgPlanId = null;
    await userRepo.save(user);

    plan.usedSeats = Math.max(0, plan.usedSeats - 1);
    await planRepo.save(plan);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.remove_member',
      targetType: 'user',
      targetId: userId,
      metadata: { planId },
      ip: ip ?? null,
    });
  }

  // ─── Admin: Family plan management ───────────────────────────────────────────

  private get familyPlanRepo() { return AppDataSource.getRepository(FamilyPlan); }
  private get familyMemberRepo() { return AppDataSource.getRepository(FamilyMember); }

  private serializeFamilyPlan(p: FamilyPlan, memberCount = 0, totalMonthlyEur = 0) {
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      parentUserId: p.parentUserId,
      parentName: p.parent
        ? `${p.parent.firstName} ${p.parent.lastName}`.trim()
        : null,
      parentEmail: p.parent?.email ?? null,
      memberCount,
      totalMonthlyEur,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private serializeFamilyMember(m: FamilyMember) {
    const TIER_PRICE: Record<string, number> = { basic: 3, pro: 5, premium: 7.5 };
    const base = TIER_PRICE[m.tier] ?? 0;
    const monthlyPriceEur = Math.round(base * (1 - m.ageDiscountPercent / 100) * 100) / 100;
    return {
      id: m.id,
      userId: m.userId,
      firstName: m.user?.firstName ?? '',
      lastName: m.user?.lastName ?? '',
      email: m.user?.email ?? '',
      tier: m.tier,
      ageDiscountPercent: m.ageDiscountPercent,
      monthlyPriceEur,
      isParent: m.isParent,
      stripeSubscriptionId: m.stripeSubscriptionId ?? null,
      createdAt: m.createdAt,
    };
  }

  async listFamilyPlans(page = 1, limit = 50) {
    const [rows, total] = await this.familyPlanRepo.findAndCount({
      relations: ['parent'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const data = await Promise.all(
      rows.map(async (p) => {
        const members = await this.familyMemberRepo.find({ where: { familyPlanId: p.id } });
        const TIER_PRICE: Record<string, number> = { basic: 3, pro: 5, premium: 7.5 };
        const totalMonthlyEur = members.reduce((sum, m) => {
          const base = TIER_PRICE[m.tier] ?? 0;
          return sum + Math.round(base * (1 - m.ageDiscountPercent / 100) * 100) / 100;
        }, 0);
        return this.serializeFamilyPlan(p, members.length, Math.round(totalMonthlyEur * 100) / 100);
      }),
    );

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getFamilyPlan(planId: string) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);

    const plan = await this.familyPlanRepo.findOne({
      where: { id: planId },
      relations: ['parent'],
    });
    if (!plan) throw new AppError('Family plan not found', 404);

    const members = await this.familyMemberRepo.find({
      where: { familyPlanId: planId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    const TIER_PRICE: Record<string, number> = { basic: 3, pro: 5, premium: 7.5 };
    const totalMonthlyEur = members.reduce((sum, m) => {
      const base = TIER_PRICE[m.tier] ?? 0;
      return sum + Math.round(base * (1 - m.ageDiscountPercent / 100) * 100) / 100;
    }, 0);

    return {
      ...this.serializeFamilyPlan(plan, members.length, Math.round(totalMonthlyEur * 100) / 100),
      members: members.map((m) => this.serializeFamilyMember(m)),
    };
  }

  async adminRemoveFamilyMember(
    planId: string,
    memberUserId: string,
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);
    if (!isUuid(memberUserId)) throw new AppError('Invalid user id', 400);

    const plan = await this.familyPlanRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);

    const member = await this.familyMemberRepo.findOne({
      where: { familyPlanId: planId, userId: memberUserId },
    });
    if (!member) throw new AppError('Member not found in this plan', 404);
    if (member.isParent) throw new AppError('Cannot remove the plan owner via admin — deactivate the plan instead', 400);

    if (member.stripeSubscriptionId) {
      await stripeService.cancelSubscription(member.stripeSubscriptionId);
    }

    await this.familyMemberRepo.remove(member);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.family_plan.remove_member',
      targetType: 'user',
      targetId: memberUserId,
      metadata: { planId },
      ip: ip ?? null,
    });
  }

  async adminChangeFamilyMemberTier(
    planId: string,
    memberUserId: string,
    newTier: SubscriptionTier,
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);
    if (!isUuid(memberUserId)) throw new AppError('Invalid user id', 400);

    const member = await this.familyMemberRepo.findOne({
      where: { familyPlanId: planId, userId: memberUserId },
    });
    if (!member) throw new AppError('Member not found in this plan', 404);

    const oldTier = member.tier;
    member.tier = newTier;
    await this.familyMemberRepo.save(member);

    // Also update the UserSubscription row
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const sub = await subRepo.findOne({ where: { user: { id: memberUserId } } });
    if (sub) {
      sub.tier = newTier;
      await subRepo.save(sub);
    }

    await adminAuditService.log({
      adminUserId,
      action: 'admin.family_plan.change_tier',
      targetType: 'user',
      targetId: memberUserId,
      metadata: { planId, oldTier, newTier },
      ip: ip ?? null,
    });

    return this.serializeFamilyMember({ ...member, user: await AppDataSource.getRepository(User).findOne({ where: { id: memberUserId } }) as User });
  }

  async adminDeactivateFamilyPlan(
    planId: string,
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);

    const plan = await this.familyPlanRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);

    // Cancel all member Stripe subscriptions
    const members = await this.familyMemberRepo.find({ where: { familyPlanId: planId } });
    for (const m of members) {
      if (m.stripeSubscriptionId) {
        await stripeService.cancelSubscription(m.stripeSubscriptionId).catch(() => {});
      }
    }

    plan.status = 'inactive';
    await this.familyPlanRepo.save(plan);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.family_plan.deactivate',
      targetType: 'family_plan',
      targetId: planId,
      metadata: { memberCount: members.length },
      ip: ip ?? null,
    });
  }
}

export const adminOrgPlanService = new AdminOrgPlanService();
