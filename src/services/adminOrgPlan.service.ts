import { validate as isUuid } from 'uuid';
import { In } from 'typeorm';
import { fromZonedTime } from 'date-fns-tz';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { OrgPlan, type OrgPlanType } from '@/database/entities/orgPlan.entity';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { FamilyPlan } from '@/database/entities/familyPlan.entity';
import { FamilyMember } from '@/database/entities/familyMember.entity';
import { UserSubscription, SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';
import { mrrCentsFromCatalogTier } from '@/common/constants/subscriptionMrr';
import { adminAuditService } from './adminAudit.service';
import { stripeService } from './stripe.service';
import { familyPlanService } from './familyPlan.service';
import { SubscriptionService, CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { APP_DEEP_LINK_CANCEL, APP_DEEP_LINK_SUCCESS } from '@/common/constants/appDeepLinks';
import { logger } from '@/config/int-services';
import {
  TIER_PRICE_EUR,
  applyDiscount,
  getChurchDiscountPercentForMemberCount,
  CHURCH_PORTAL_MONTHLY_FEE_EUR,
  CHURCH_DISCOUNT_PERCENT,
  CHURCH_BULK_MEMBER_THRESHOLD,
} from '@/common/constants/subscriptionPricing';
import { ChurchPortal } from '@/church-portal/entities/churchPortal.entity';

const subscriptionService = new SubscriptionService(new EmailService(null));

const CHURCH_PLAN_TYPE: OrgPlanType = 'church';
/** Match Stripe checkout session max age so pending reservations survive slow payers. */
const CHURCH_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type PendingChurchAssignment = {
  userId: string;
  tier: string;
  createdAt: string;
};

function parsePendingChurchAssignments(
  metadata: Record<string, unknown> | null | undefined,
): PendingChurchAssignment[] {
  const raw = metadata?.pendingAssignments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is PendingChurchAssignment =>
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as PendingChurchAssignment).userId === 'string' &&
      typeof (entry as PendingChurchAssignment).createdAt === 'string',
  );
}

function pruneExpiredPendingChurchAssignments(
  pending: PendingChurchAssignment[],
): PendingChurchAssignment[] {
  const cutoff = Date.now() - CHURCH_PENDING_TTL_MS;
  return pending.filter((entry) => new Date(entry.createdAt).getTime() > cutoff);
}

function reservedChurchSeats(plan: OrgPlan): number {
  return plan.usedSeats + pruneExpiredPendingChurchAssignments(parsePendingChurchAssignments(plan.metadata)).length;
}

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

  async list(page = 1, limit = 50) {
    const repo = AppDataSource.getRepository(OrgPlan);
    const [rows, total] = await repo.findAndCount({
      where: { planType: CHURCH_PLAN_TYPE },
      relations: ['billingAdmin'],
      order: { status: 'ASC', createdAt: 'DESC' },
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

  async get(planId: string) {
    if (!isUuid(planId)) {
      throw new AppError('Invalid plan id', 400);
    }

    const row = await AppDataSource.getRepository(OrgPlan).findOne({
      where: { id: planId, planType: CHURCH_PLAN_TYPE },
      relations: ['billingAdmin'],
    });
    if (!row) {
      throw new AppError('Plan not found', 404);
    }

    return this.serialize(row);
  }

  async create(
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
      planType: CHURCH_PLAN_TYPE,
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
      metadata: { planType: CHURCH_PLAN_TYPE },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async update(
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
    const row = await repo.findOne({ where: { id: planId, planType: CHURCH_PLAN_TYPE } });
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
      metadata: { planType: CHURCH_PLAN_TYPE, patch: Object.keys(input) },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async deactivate(planId: string, adminUserId: string, ip?: string) {
    return this.update(planId, { status: 'inactive' }, adminUserId, ip);
  }

  private async ensureChurchPlan(planId: string): Promise<OrgPlan> {
    if (!isUuid(planId)) {
      throw new AppError('Invalid plan id', 400);
    }
    const plan = await AppDataSource.getRepository(OrgPlan).findOne({
      where: { id: planId, planType: CHURCH_PLAN_TYPE },
    });
    if (!plan) {
      throw new AppError('Plan not found', 404);
    }
    return plan;
  }

  /** Remove expired pending church checkout reservations from all active plans. */
  async pruneExpiredPendingChurchCheckouts(): Promise<number> {
    const planRepo = AppDataSource.getRepository(OrgPlan);
    const plans = await planRepo.find({
      where: { planType: CHURCH_PLAN_TYPE, status: 'active' },
    });

    let pruned = 0;
    for (const plan of plans) {
      const before = parsePendingChurchAssignments(plan.metadata);
      const after = pruneExpiredPendingChurchAssignments(before);
      if (after.length < before.length) {
        pruned += before.length - after.length;
        plan.metadata = { ...(plan.metadata ?? {}), pendingAssignments: after };
        await planRepo.save(plan);
      }
    }
    return pruned;
  }

  async getMembers(planId: string) {
    await this.ensureChurchPlan(planId);
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
    await this.ensureChurchPlan(planId);

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

    const userIds = users.map((u) => u.id);
    const sessionRepo = AppDataSource.getRepository(Session);
    const totalSessions = userIds.length
      ? await sessionRepo
          .createQueryBuilder('s')
          .where('s.menteeId IN (:...userIds)', { userIds })
          .andWhere('s.status IN (:...statuses)', {
            statuses: [SESSION_STATUS.COMPLETED, SESSION_STATUS.CONFIRMED, SESSION_STATUS.IN_PROGRESS],
          })
          .getCount()
      : 0;

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

  async releasePendingChurchCheckout(planId: string, userId: string): Promise<void> {
    await this.releasePendingChurchAssignment(planId, userId);
  }

  private async releasePendingChurchAssignment(planId: string, userId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(OrgPlan);
      const plan = await planRepo.findOne({
        where: { id: planId, planType: 'church' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan) return;

      const pending = pruneExpiredPendingChurchAssignments(
        parsePendingChurchAssignments(plan.metadata),
      ).filter((entry) => entry.userId !== userId);

      plan.metadata = { ...(plan.metadata ?? {}), pendingAssignments: pending };
      await planRepo.save(plan);
    });
  }

  async assignMember(
    planId: string,
    userId: string,
    tier: 'basic' | 'pro' | 'premium',
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);
    if (!isUuid(userId)) throw new AppError('Invalid user id', 400);

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.orgPlanId) throw new AppError('User is already assigned to an org plan', 409);

    let discountPercent = CHURCH_DISCOUNT_PERCENT;

    await AppDataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(OrgPlan);
      const plan = await planRepo.findOne({
        where: { id: planId, status: 'active', planType: 'church' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan) throw new AppError('Plan not found or inactive', 404);

      const pending = pruneExpiredPendingChurchAssignments(
        parsePendingChurchAssignments(plan.metadata),
      ).filter((entry) => entry.userId !== userId);

      if (plan.usedSeats + pending.length >= plan.totalSeats) {
        throw new AppError('Plan has no available seats', 409);
      }

      const memberTiers = {
        ...((plan.metadata?.memberTiers as Record<string, string> | undefined) ?? {}),
        [userId]: tier,
      };

      plan.metadata = {
        ...(plan.metadata ?? {}),
        pendingAssignments: pending,
        memberTiers,
      };
      plan.usedSeats += 1;
      user.orgPlanId = planId;
      await planRepo.save(plan);
      await manager.getRepository(User).save(user);
    });

    discountPercent = await this.resolveChurchDiscountPercent(planId);
    await userRepo.update(userId, { churchDiscountPercent: discountPercent });

    const monthlyEur = applyDiscount(TIER_PRICE_EUR[tier], discountPercent);
    await subscriptionService.upsertSubscription(userId, {
      tier,
      status: 'active',
      externalProvider: 'church_central',
      externalRef: null,
      mrrCents: Math.round(monthlyEur * 100),
      billingInterval: 'monthly',
      notes: 'church_central_billing',
    });

    await this.syncLinkedPortalDiscounts(planId);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.assign_member',
      targetType: 'user',
      targetId: userId,
      metadata: { planId, tier, discountPercent, billing: 'central' },
      ip: ip ?? null,
    });

    return { assigned: true, discountPercent, tier, checkoutUrl: null as string | null };
  }

  /** Member count for discount = mentors + mentees on linked portal, else org-plan used seats. */
  async resolveChurchDiscountPercent(planId: string): Promise<number> {
    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { orgPlanId: planId },
      select: ['id'],
    });
    if (portal) {
      const count = await AppDataSource.getRepository(User).count({
        where: { churchPortalId: portal.id },
      });
      return getChurchDiscountPercentForMemberCount(count);
    }
    const plan = await AppDataSource.getRepository(OrgPlan).findOne({
      where: { id: planId },
      select: ['usedSeats'],
    });
    return getChurchDiscountPercentForMemberCount(plan?.usedSeats ?? 0);
  }

  async syncLinkedPortalDiscounts(planId: string): Promise<void> {
    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { orgPlanId: planId },
    });
    if (!portal) return;
    await this.syncChurchPortalMemberDiscounts(portal.id);
  }

  async syncChurchPortalMemberDiscounts(churchPortalId: string): Promise<number> {
    const userRepo = AppDataSource.getRepository(User);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);
    const count = await userRepo.count({ where: { churchPortalId } });
    const discountPercent = getChurchDiscountPercentForMemberCount(count);

    await portalRepo.update(churchPortalId, { discountPercent });
    await userRepo.update({ churchPortalId }, { churchDiscountPercent: discountPercent });
    return discountPercent;
  }

  async generateChurchInvoice(planId: string, adminUserId: string, ip?: string) {
    return this.createChurchPlanInvoice({
      planId,
      actor: { kind: 'admin', id: adminUserId },
      ip,
    });
  }

  /**
   * Church portal self-serve: pastor generates the same central invoice.
   * Uses org-plan billing admin email when set; otherwise the portal user's email.
   */
  async generateChurchInvoiceFromPortal(
    churchPortalId: string,
    portalUser: { id: string; email: string; firstName?: string | null; lastName?: string | null },
    ip?: string,
  ) {
    if (!isUuid(churchPortalId)) throw new AppError('Invalid portal id', 400);

    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { id: churchPortalId },
    });
    if (!portal) throw new AppError('Church portal not found', 404);
    if (!portal.orgPlanId) {
      throw new AppError(
        'This church is not linked to a billing plan yet. Contact Spiriment support.',
        400,
      );
    }
    if (!portalUser.email) {
      throw new AppError('Your portal account has no email address', 400);
    }

    const plan = await this.get(portal.orgPlanId);
    const lastAt = (plan.metadata as any)?.lastPortalInvoiceAt as string | undefined;
    if (lastAt) {
      const hours = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60);
      if (hours < 24) {
        throw new AppError(
          'An invoice was already generated in the last 24 hours. Please wait before generating another.',
          429,
        );
      }
    }

    const result = await this.createChurchPlanInvoice({
      planId: portal.orgPlanId,
      actor: { kind: 'church_portal', id: portalUser.id },
      ip,
      fallbackRecipient: {
        email: portalUser.email,
        name: `${portalUser.firstName ?? ''} ${portalUser.lastName ?? ''}`.trim() || portal.name,
      },
    });

    const fresh = await AppDataSource.getRepository(OrgPlan).findOne({
      where: { id: portal.orgPlanId },
    });
    if (fresh) {
      fresh.metadata = {
        ...(fresh.metadata ?? {}),
        lastPortalInvoiceAt: new Date().toISOString(),
        lastPortalInvoiceId: result.invoiceId,
      };
      await AppDataSource.getRepository(OrgPlan).save(fresh);
    }

    return result;
  }

  async getChurchInvoicePreviewForPortal(churchPortalId: string) {
    if (!isUuid(churchPortalId)) throw new AppError('Invalid portal id', 400);
    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { id: churchPortalId },
    });
    if (!portal) throw new AppError('Church portal not found', 404);
    if (!portal.orgPlanId) {
      throw new AppError(
        'This church is not linked to a billing plan yet. Contact Spiriment support.',
        400,
      );
    }

    const draft = await this.buildChurchInvoiceDraft(portal.orgPlanId);
    const plan = await this.get(portal.orgPlanId);
    const lastPortalInvoiceAt =
      ((plan.metadata as any)?.lastPortalInvoiceAt as string | undefined) ?? null;
    let canGenerate = true;
    let nextGenerateAt: string | null = null;
    if (lastPortalInvoiceAt) {
      const next = new Date(lastPortalInvoiceAt).getTime() + 24 * 60 * 60 * 1000;
      if (Date.now() < next) {
        canGenerate = false;
        nextGenerateAt = new Date(next).toISOString();
      }
    }

    let billingEmail: string | null = null;
    if (plan.billingAdminUserId) {
      const billingAdmin = await AppDataSource.getRepository(User).findOne({
        where: { id: plan.billingAdminUserId },
        select: ['email'],
      });
      billingEmail = billingAdmin?.email ?? null;
    }

    return {
      ...draft,
      lastPortalInvoiceAt,
      lastPortalInvoiceId:
        ((plan.metadata as any)?.lastPortalInvoiceId as string | undefined) ?? null,
      canGenerate,
      nextGenerateAt,
      billingEmail,
    };
  }

  private async buildChurchInvoiceDraft(planId: string) {
    const plan = await this.get(planId);
    if (plan.status !== 'active') throw new AppError('Plan is not active', 400);

    const members = await AppDataSource.getRepository(User).find({
      where: { orgPlanId: planId },
      select: ['id', 'firstName', 'lastName', 'email', 'role'],
    });

    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { orgPlanId: planId },
    });
    const portalMemberCount = portal
      ? await AppDataSource.getRepository(User).count({ where: { churchPortalId: portal.id } })
      : members.length;
    const discountPercent = getChurchDiscountPercentForMemberCount(portalMemberCount);

    const memberTiers =
      ((plan.metadata as any)?.memberTiers as Record<string, string> | undefined) ?? {};
    const subs = members.length
      ? await AppDataSource.getRepository(UserSubscription).find({
          where: { userId: In(members.map((m) => m.id)) },
        })
      : [];
    const subByUser = new Map(subs.map((s) => [s.userId, s]));

    const lineItems: Array<{ description: string; amountCents: number }> = [
      {
        description: `Church portal dashboard — monthly access (€${CHURCH_PORTAL_MONTHLY_FEE_EUR})`,
        amountCents: CHURCH_PORTAL_MONTHLY_FEE_EUR * 100,
      },
    ];

    for (const member of members) {
      const tierRaw =
        memberTiers[member.id] ||
        subByUser.get(member.id)?.tier ||
        'basic';
      const tier = (['basic', 'pro', 'premium'].includes(tierRaw) ? tierRaw : 'basic') as
        | 'basic'
        | 'pro'
        | 'premium';
      const amountEur = applyDiscount(TIER_PRICE_EUR[tier], discountPercent);
      const name = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.email;
      lineItems.push({
        description: `${name} — ${tier} (${discountPercent}% church discount)`,
        amountCents: Math.round(amountEur * 100),
      });
    }

    const totalCents = lineItems.reduce((sum, i) => sum + i.amountCents, 0);
    return {
      planId,
      planName: plan.name,
      discountPercent,
      portalFeeEur: CHURCH_PORTAL_MONTHLY_FEE_EUR,
      memberCount: members.length,
      portalMemberCount,
      bulkThreshold: CHURCH_BULK_MEMBER_THRESHOLD,
      lineItems,
      totalCents,
      totalEur: Math.round(totalCents) / 100,
      billingAdminUserId: plan.billingAdminUserId ?? null,
    };
  }

  private async createChurchPlanInvoice(opts: {
    planId: string;
    actor: { kind: 'admin' | 'church_portal'; id: string };
    ip?: string;
    billingOverride?: {
      email?: string;
      name?: string;
      userId?: string | null;
    };
    fallbackRecipient?: { email: string; name: string };
  }) {
    const draft = await this.buildChurchInvoiceDraft(opts.planId);
    const plan = await this.get(opts.planId);

    let email = opts.billingOverride?.email;
    let name = opts.billingOverride?.name;
    let userId = opts.billingOverride?.userId;

    if (!email) {
      const billingAdminId = plan.billingAdminUserId;
      if (billingAdminId) {
        const billingAdmin = await AppDataSource.getRepository(User).findOne({
          where: { id: billingAdminId },
          select: ['id', 'email', 'firstName', 'lastName'],
        });
        if (!billingAdmin?.email) {
          throw new AppError('Billing admin has no email address', 400);
        }
        email = billingAdmin.email;
        name = `${billingAdmin.firstName ?? ''} ${billingAdmin.lastName ?? ''}`.trim();
        userId = billingAdmin.id;
      } else if (opts.fallbackRecipient?.email) {
        email = opts.fallbackRecipient.email;
        name = opts.fallbackRecipient.name;
        userId = null;
      } else {
        throw new AppError(
          'No billing email is configured. Assign a billing admin or use a portal account with an email.',
          400,
        );
      }
    }

    const invoice = await stripeService.createAndSendInvoice({
      email,
      name,
      userId: userId ?? null,
      description: `Spiriment church plan — ${plan.name}`,
      lineItems: draft.lineItems,
      metadata: {
        planType: 'church',
        orgPlanId: opts.planId,
        discountPercent: String(draft.discountPercent),
        memberCount: String(draft.memberCount),
        portalMemberCount: String(draft.portalMemberCount),
        generatedBy: opts.actor.kind,
        generatedById: opts.actor.id,
      },
    });

    if (opts.actor.kind === 'admin') {
      await adminAuditService.log({
        adminUserId: opts.actor.id,
        action: 'admin.org_plan.generate_invoice',
        targetType: 'org_plan',
        targetId: opts.planId,
        metadata: {
          invoiceId: invoice.invoiceId,
          totalCents: invoice.totalCents,
          discountPercent: draft.discountPercent,
          lineItemCount: draft.lineItems.length,
        },
        ip: opts.ip ?? null,
      });
    }

    return {
      ...invoice,
      emailedTo: email,
      discountPercent: draft.discountPercent,
      portalFeeEur: CHURCH_PORTAL_MONTHLY_FEE_EUR,
      memberCount: draft.memberCount,
      bulkThreshold: CHURCH_BULK_MEMBER_THRESHOLD,
      lineItems: draft.lineItems,
      totalEur: Math.round(invoice.totalCents) / 100,
    };
  }

  async generateFamilyInvoice(planId: string, adminUserId: string, ip?: string) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);

    const plan = await this.familyPlanRepo.findOne({
      where: { id: planId },
      relations: ['parent'],
    });
    if (!plan) throw new AppError('Family plan not found', 404);
    if (plan.status !== 'active') throw new AppError('Family plan is not active', 400);
    if (!plan.parent?.email) {
      throw new AppError('Family plan owner has no email address', 400);
    }

    const members = await this.familyMemberRepo.find({
      where: { familyPlanId: planId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    if (members.length === 0) {
      throw new AppError('Family plan has no members to invoice', 400);
    }

    const subsByUser = await this.loadMemberSubscriptions(members);
    const lineItems: Array<{ description: string; amountCents: number }> = [];

    for (const m of members) {
      const eur = this.memberMonthlyEur(m, subsByUser.get(m.userId));
      if (eur <= 0) continue;
      const name =
        `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim() ||
        m.user?.email ||
        m.userId;
      const discountNote =
        m.ageDiscountPercent > 0 ? ` (${m.ageDiscountPercent}% youth discount)` : '';
      lineItems.push({
        description: `${name} — ${m.tier}${discountNote}`,
        amountCents: Math.round(eur * 100),
      });
    }

    if (lineItems.length === 0) {
      throw new AppError('No billable family members found', 400);
    }

    const invoice = await stripeService.createAndSendInvoice({
      email: plan.parent.email,
      name: `${plan.parent.firstName ?? ''} ${plan.parent.lastName ?? ''}`.trim(),
      userId: plan.parentUserId,
      description: `Spiriment family plan — ${plan.name}`,
      lineItems,
      metadata: {
        planType: 'family',
        familyPlanId: planId,
        memberCount: String(members.length),
      },
    });

    await adminAuditService.log({
      adminUserId,
      action: 'admin.family_plan.generate_invoice',
      targetType: 'family_plan',
      targetId: planId,
      metadata: {
        invoiceId: invoice.invoiceId,
        totalCents: invoice.totalCents,
        lineItemCount: lineItems.length,
      },
      ip: ip ?? null,
    });

    return {
      ...invoice,
      emailedTo: plan.parent.email,
      memberCount: members.length,
      portalFeeEur: 0,
    };
  }

  async completeChurchMemberAssignment(userId: string, orgPlanId: string): Promise<void> {
    if (!isUuid(userId) || !isUuid(orgPlanId)) {
      throw new AppError('Invalid church assignment ids', 400);
    }

    await AppDataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const planRepo = manager.getRepository(OrgPlan);

      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found for church assignment', 404);
      }

      if (user.orgPlanId === orgPlanId) {
        return;
      }

      if (user.orgPlanId) {
        throw new AppError('User is already assigned to another org plan', 409);
      }

      const plan = await planRepo.findOne({
        where: { id: orgPlanId, planType: 'church', status: 'active' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan) {
        throw new AppError('Church plan not found or inactive', 404);
      }

      const pending = pruneExpiredPendingChurchAssignments(
        parsePendingChurchAssignments(plan.metadata),
      );
      const hadPending = pending.some((entry) => entry.userId === userId);
      const pendingAfterRemoval = pending.filter((entry) => entry.userId !== userId);

      if (!hadPending && plan.usedSeats >= plan.totalSeats) {
        throw new AppError('Church plan has no available seats', 409);
      }
      if (hadPending && plan.usedSeats + pending.length > plan.totalSeats) {
        throw new AppError('Church plan seat reservation is invalid', 409);
      }

      plan.metadata = { ...(plan.metadata ?? {}), pendingAssignments: pendingAfterRemoval };
      user.orgPlanId = orgPlanId;
      plan.usedSeats += 1;
      await userRepo.save(user);
      await planRepo.save(plan);
    });
  }

  /** Idempotent link after Stripe checkout — safe on subscription.created and .updated. */
  async ensureChurchMemberAssignment(userId: string, orgPlanId: string): Promise<void> {
    if (!isUuid(userId) || !isUuid(orgPlanId)) {
      throw new AppError('Invalid church assignment ids', 400);
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'orgPlanId'],
    });
    if (!user) {
      throw new AppError('User not found for church assignment', 404);
    }
    if (user.orgPlanId === orgPlanId) {
      return;
    }

    await this.completeChurchMemberAssignment(userId, orgPlanId);
  }

  /** Clear church org membership and free a seat when billing ends. */
  async releaseChurchMembership(userId: string): Promise<void> {
    if (!isUuid(userId)) return;

    await AppDataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const planRepo = manager.getRepository(OrgPlan);

      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user?.orgPlanId) return;

      const orgPlanId = user.orgPlanId;
      const plan = await planRepo.findOne({
        where: { id: orgPlanId, planType: 'church' },
        lock: { mode: 'pessimistic_write' },
      });

      user.orgPlanId = null;
      await userRepo.save(user);

      if (plan) {
        plan.usedSeats = Math.max(0, plan.usedSeats - 1);
        await planRepo.save(plan);
      }
    });
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

    const subRepo = AppDataSource.getRepository(UserSubscription);
    const sub = await subRepo.findOne({ where: { userId } });
    if (
      sub?.externalRef &&
      (sub.externalProvider === 'stripe' || sub.externalProvider === 'stripe_family')
    ) {
      await stripeService.cancelSubscriptionAtPeriodEnd(sub.externalRef);
      await subscriptionService.upsertSubscription(userId, {
        tier: sub.tier,
        status: sub.status,
        externalProvider: sub.externalProvider,
        externalRef: sub.externalRef,
        expiresAt: sub.expiresAt,
        mrrCents: sub.mrrCents,
        billingInterval: sub.billingInterval,
        notes: CANCEL_AT_PERIOD_END_NOTE,
      });
    }
    await this.releaseChurchMembership(userId);

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

  private serializeFamilyPlan(
    p: FamilyPlan,
    memberCount = 0,
    totalMonthlyEur = 0,
    mrrIsEstimated = false,
  ) {
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
      mrrIsEstimated,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private async loadMemberSubscriptions(
    members: FamilyMember[],
  ): Promise<Map<string, UserSubscription>> {
    if (members.length === 0) return new Map();
    const userIds = members.map((m) => m.userId);
    const subs = await AppDataSource.getRepository(UserSubscription).find({
      where: { userId: In(userIds) },
    });
    return new Map(subs.map((s) => [s.userId, s]));
  }

  private memberMonthlyEur(m: FamilyMember, sub?: UserSubscription | null): number {
    if (sub?.mrrCents != null && sub.mrrCents > 0) {
      return Math.round(sub.mrrCents) / 100;
    }
    const interval = sub?.billingInterval ?? 'monthly';
    if (m.tier === 'basic' || m.tier === 'pro' || m.tier === 'premium') {
      const catalogCents = mrrCentsFromCatalogTier(m.tier, interval);
      const discounted = Math.round(catalogCents * (1 - m.ageDiscountPercent / 100));
      return discounted / 100;
    }
    return 0;
  }

  private computeFamilyTotals(
    members: FamilyMember[],
    subsByUser: Map<string, UserSubscription>,
  ): { totalMonthlyEur: number; mrrIsEstimated: boolean } {
    let totalCents = 0;
    let mrrIsEstimated = false;
    for (const m of members) {
      const sub = subsByUser.get(m.userId);
      if (sub?.mrrCents != null && sub.mrrCents > 0) {
        totalCents += sub.mrrCents;
      } else {
        mrrIsEstimated = true;
        totalCents += Math.round(this.memberMonthlyEur(m, sub) * 100);
      }
    }
    return {
      totalMonthlyEur: Math.round(totalCents) / 100,
      mrrIsEstimated,
    };
  }

  private serializeFamilyMember(m: FamilyMember, sub?: UserSubscription | null) {
    const monthlyPriceEur = this.memberMonthlyEur(m, sub);
    const mrrIsEstimated = !(sub?.mrrCents != null && sub.mrrCents > 0);
    return {
      id: m.id,
      userId: m.userId,
      firstName: m.user?.firstName ?? '',
      lastName: m.user?.lastName ?? '',
      email: m.user?.email ?? '',
      role: m.user?.role ?? 'mentee',
      tier: m.tier,
      ageDiscountPercent: m.ageDiscountPercent,
      monthlyPriceEur,
      mrrIsEstimated,
      isParent: m.isParent,
      stripeSubscriptionId: m.stripeSubscriptionId ?? null,
      createdAt: m.createdAt,
    };
  }

  async listFamilyPlans(page = 1, limit = 50) {
    const [rows, total] = await this.familyPlanRepo.findAndCount({
      relations: ['parent'],
      order: { status: 'ASC', createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    const data = await Promise.all(
      rows.map(async (p) => {
        const members = await this.familyMemberRepo.find({ where: { familyPlanId: p.id } });
        const subsByUser = await this.loadMemberSubscriptions(members);
        const { totalMonthlyEur, mrrIsEstimated } = this.computeFamilyTotals(members, subsByUser);
        return this.serializeFamilyPlan(p, members.length, totalMonthlyEur, mrrIsEstimated);
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

    const subsByUser = await this.loadMemberSubscriptions(members);
    const { totalMonthlyEur, mrrIsEstimated } = this.computeFamilyTotals(members, subsByUser);

    return {
      ...this.serializeFamilyPlan(plan, members.length, totalMonthlyEur, mrrIsEstimated),
      members: members.map((m) => this.serializeFamilyMember(m, subsByUser.get(m.userId))),
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

    await familyPlanService.adminRemoveMember(planId, memberUserId);

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

    const result = await familyPlanService.adminChangeMemberTier(planId, memberUserId, newTier);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.family_plan.change_tier',
      targetType: 'user',
      targetId: memberUserId,
      metadata: { planId, oldTier: member.tier, newTier, checkoutUrl: result.checkoutUrl },
      ip: ip ?? null,
    });

    const memberUser = await AppDataSource.getRepository(User).findOne({ where: { id: memberUserId } });

    return {
      ...this.serializeFamilyMember({ ...member, user: memberUser as User }),
      pendingTier: newTier,
      checkoutUrl: result.checkoutUrl,
      effectivePriceEur: result.effectivePriceEur,
      billingInterval: result.billingInterval,
    };
  }

  async adminDeactivateFamilyPlan(
    planId: string,
    adminUserId: string,
    ip?: string,
  ) {
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);

    const plan = await this.familyPlanRepo.findOne({ where: { id: planId } });
    if (!plan) throw new AppError('Family plan not found', 404);

    const members = await this.familyMemberRepo.find({ where: { familyPlanId: planId } });
    await familyPlanService.adminDeactivatePlan(planId);

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
