import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import {
  OrgPlan,
  type OrgPlanType,
} from '@/database/entities/orgPlan.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';
import { adminAuditService } from './adminAudit.service';
import { stripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';
import { EmailService } from '@/core/email.service';

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

    const successUrl = process.env.APP_DEEP_LINK ?? 'spiriment://subscription/success';
    const cancelUrl = process.env.APP_DEEP_LINK ?? 'spiriment://subscription/cancel';

    const checkoutUrl = await stripeService.createCheckoutSession({
      user,
      tier,
      successUrl,
      cancelUrl,
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
}

export const adminOrgPlanService = new AdminOrgPlanService();
