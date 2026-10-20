import { validate as isUuid } from 'uuid';
import { In, IsNull, Not } from 'typeorm';
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
import { ChurchPortal, CHURCH_PORTAL_STATUS } from '@/church-portal/entities/churchPortal.entity';
import { ChurchPortalUser } from '@/church-portal/entities/churchPortalUser.entity';

/** Who changed church billing: a Spiriment admin, a pastor in the church portal, or the scheduler */
export type BillingActor = { kind: 'admin' | 'church_portal' | 'system'; id: string };
import { stripePayingMemberIds, syncChurchCouponsInBackground } from './churchDiscountSync.service';
import { adminAlertService } from './adminAlert.service';
import {
  invoiceDisplayStatus,
  readInvoiceRecords,
  toInvoiceStatus,
  upsertInvoiceRecord,
  type ChurchInvoiceRecord,
  type ChurchInvoiceStatus,
} from '@/common/churchBilling';

const subscriptionService = new SubscriptionService(new EmailService(null));

const CHURCH_PLAN_TYPE: OrgPlanType = 'church';

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
      invoices: this.invoicesForDisplay(p.metadata),
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
      // Invoice history is written by the system; a metadata edit must not wipe it
      const invoices = row.metadata?.invoices;
      row.metadata = invoices !== undefined ? { ...(input.metadata ?? {}), invoices } : input.metadata;
    }
    const deactivating = input.status === 'inactive' && row.status !== 'inactive';
    if (input.status !== undefined) {
      row.status = input.status;
    }

    let saved = await repo.save(row);

    // A deactivated plan stops paying: end church-billed access and free every seat
    let membersEnded = 0;
    if (deactivating) {
      const members = await AppDataSource.getRepository(User).find({
        where: { orgPlanId: planId },
        select: ['id'],
      });
      for (const m of members) {
        try {
          await this.endChurchPaidAccess(m.id, planId);
          membersEnded++;
        } catch (err) {
          logger.error('Failed to end church plan access on deactivation', err instanceof Error ? err : new Error(String(err)), {
            planId,
            userId: m.id,
          });
        }
      }
      saved = (await repo.findOne({ where: { id: planId } })) ?? saved;
    }

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.update',
      targetType: 'org_plan',
      targetId: planId,
      metadata: {
        planType: CHURCH_PLAN_TYPE,
        patch: Object.keys(input),
        ...(deactivating ? { membersEnded } : {}),
      },
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

  async assignMember(
    planId: string,
    userId: string,
    tier: 'basic' | 'pro' | 'premium',
    /** Admin user id (admin panel), or the acting pastor / system */
    actorOrAdminId: string | BillingActor,
    ip?: string,
  ) {
    const actor: BillingActor =
      typeof actorOrAdminId === 'string' ? { kind: 'admin', id: actorOrAdminId } : actorOrAdminId;
    if (!isUuid(planId)) throw new AppError('Invalid plan id', 400);
    if (!isUuid(userId)) throw new AppError('Invalid user id', 400);

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);
    if (user.orgPlanId === planId) throw new AppError('The church already pays for this member', 409);
    if (user.orgPlanId) throw new AppError('This member is already paid for by another church plan', 409);

    // Someone already paying for themselves would be charged twice (their own store/Stripe
    // billing keeps running), or the church billed for a seat that never takes effect
    const ownSub = await AppDataSource.getRepository(UserSubscription).findOne({ where: { userId } });
    const paysOwnWay =
      !!ownSub &&
      ['stripe', 'stripe_family', 'revenuecat'].includes(ownSub.externalProvider ?? '') &&
      ['active', 'past_due', 'trialing'].includes(ownSub.status) &&
      ownSub.tier !== 'free';
    if (paysOwnWay) {
      const where = ownSub!.externalProvider === 'revenuecat' ? 'the App Store' : ownSub!.externalProvider === 'stripe_family' ? 'a family plan' : 'Stripe';
      throw new AppError(
        `This member already pays for their own ${ownSub!.tier} plan through ${where}. They need to cancel it (and let it run out) before the church can pay for them.`,
        409,
      );
    }

    let discountPercent = CHURCH_DISCOUNT_PERCENT;

    await AppDataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(OrgPlan);
      const plan = await planRepo.findOne({
        where: { id: planId, status: 'active', planType: 'church' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!plan) throw new AppError('Plan not found or inactive', 404);

      // 0 = no cap (plans created from the portal); an admin can set one
      if (plan.totalSeats > 0 && plan.usedSeats >= plan.totalSeats) {
        throw new AppError(`All ${plan.totalSeats} paid places on this church plan are used. Contact Spiriment to add more.`, 409);
      }

      const memberTiers = {
        ...((plan.metadata?.memberTiers as Record<string, string> | undefined) ?? {}),
        [userId]: tier,
      };

      plan.metadata = {
        ...(plan.metadata ?? {}),
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

    await this.logBillingAction(actor, 'admin.org_plan.assign_member', userId, {
      planId,
      tier,
      discountPercent,
      billing: 'central',
    }, ip);

    return { assigned: true, discountPercent, tier, checkoutUrl: null as string | null };
  }

  /** Move a church-paid member to another tier (from the next invoice). */
  async changeMemberTier(
    planId: string,
    userId: string,
    tier: 'basic' | 'pro' | 'premium',
    actor: BillingActor,
    ip?: string,
  ) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'orgPlanId', 'churchDiscountPercent'],
    });
    if (!user || user.orgPlanId !== planId) {
      throw new AppError('This member is not paid for by the church', 400);
    }

    await AppDataSource.transaction(async (manager) => {
      const planRepo = manager.getRepository(OrgPlan);
      const plan = await planRepo.findOne({ where: { id: planId }, lock: { mode: 'pessimistic_write' } });
      if (!plan) throw new AppError('Plan not found', 404);
      plan.metadata = {
        ...(plan.metadata ?? {}),
        memberTiers: { ...((plan.metadata?.memberTiers as Record<string, string> | undefined) ?? {}), [userId]: tier },
      };
      await planRepo.save(plan);
    });

    const discountPercent = await this.resolveChurchDiscountPercent(planId);
    await subscriptionService.upsertSubscription(userId, {
      tier,
      status: 'active',
      externalProvider: 'church_central',
      externalRef: null,
      mrrCents: Math.round(applyDiscount(TIER_PRICE_EUR[tier], discountPercent) * 100),
      billingInterval: 'monthly',
      notes: 'church_central_billing',
    });

    await this.logBillingAction(actor, 'admin.org_plan.change_member_tier', userId, { planId, tier }, ip);
    return { tier };
  }

  /** Admin actions go to the admin audit log; pastor actions (no admin account) to the app log. */
  private async logBillingAction(
    actor: BillingActor,
    action: string,
    targetId: string,
    metadata: Record<string, unknown>,
    ip?: string,
  ) {
    if (actor.kind === 'admin') {
      await adminAuditService.log({ adminUserId: actor.id, action, targetType: 'user', targetId, metadata, ip: ip ?? null });
    } else {
      logger.info(`Church billing: ${action}`, { ...metadata, targetId, actor });
    }
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

  /**
   * Recompute the church discount for every member (5%, 10% from 100 members, 0% while the
   * church is suspended) and keep members' own Stripe coupons in line.
   * `statusChange` comes from the admin suspending or reactivating the church.
   */
  async syncChurchPortalMemberDiscounts(
    churchPortalId: string,
    opts: { statusChange?: 'suspended' | 'reactivated' } = {},
  ): Promise<number> {
    const userRepo = AppDataSource.getRepository(User);
    const portalRepo = AppDataSource.getRepository(ChurchPortal);
    const before = await portalRepo.findOne({
      where: { id: churchPortalId },
      select: ['id', 'discountPercent', 'status', 'metadata'],
    });
    const count = await userRepo.count({ where: { churchPortalId } });
    const suspended = before?.status === CHURCH_PORTAL_STATUS.SUSPENDED;
    const discountPercent = suspended ? 0 : getChurchDiscountPercentForMemberCount(count);

    await portalRepo.update(churchPortalId, { discountPercent });
    await userRepo.update({ churchPortalId }, { churchDiscountPercent: discountPercent });
    if (!before) return discountPercent;

    // Remember whose Stripe coupon suspension removed, so reactivation restores exactly those
    const saveRemovedCoupons = async (userIds: string[] | null) => {
      const fresh = await portalRepo.findOne({ where: { id: churchPortalId }, select: ['id', 'metadata'] });
      if (!fresh) return;
      const { couponsRemovedOnSuspension: previous, ...rest } = (fresh.metadata ?? {}) as Record<string, unknown>;
      const merged = userIds
        ? Array.from(new Set([...(Array.isArray(previous) ? (previous as string[]) : []), ...userIds]))
        : [];
      fresh.metadata = merged.length ? { ...rest, couponsRemovedOnSuspension: merged } : rest;
      await portalRepo.save(fresh);
    };

    if (opts.statusChange === 'suspended') {
      syncChurchCouponsInBackground(await stripePayingMemberIds(churchPortalId), `church ${churchPortalId} suspended`, {
        onDone: (changed) => saveRemovedCoupons(changed),
      });
    } else if (opts.statusChange === 'reactivated') {
      const removed = (before.metadata?.couponsRemovedOnSuspension as string[] | undefined) ?? [];
      const payers = new Set(await stripePayingMemberIds(churchPortalId));
      syncChurchCouponsInBackground(
        removed.filter((id) => payers.has(id)),
        `church ${churchPortalId} reactivated`,
        { mode: 'restore', onDone: () => saveRemovedCoupons(null) },
      );
    } else if (before.discountPercent !== discountPercent) {
      // Crossing the 100-member line: move members' existing Stripe coupons to the new percent
      syncChurchCouponsInBackground(
        await stripePayingMemberIds(churchPortalId),
        `church ${churchPortalId} discount ${before.discountPercent}% → ${discountPercent}%`,
      );
    }
    return discountPercent;
  }

  /** The church portal with its billing plan (created on first use) */
  private async portalWithPlan(churchPortalId: string): Promise<ChurchPortal & { orgPlanId: string }> {
    const { churchBillingService } = await import('./churchBilling.service');
    const orgPlanId = await churchBillingService.ensurePlanForPortal(churchPortalId);
    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({ where: { id: churchPortalId } });
    if (!portal) throw new AppError('Church portal not found', 404);
    return Object.assign(portal, { orgPlanId });
  }

  /** The monthly scheduled invoice (see ChurchBillingService.runAutoInvoices) */
  async generateChurchInvoiceAutomatically(planId: string) {
    return this.createChurchPlanInvoice({ planId, actor: { kind: 'system', id: 'auto-invoice' } });
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

    const portal = await this.portalWithPlan(churchPortalId);
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
    const portal = await this.portalWithPlan(churchPortalId);

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

    // Same order the invoice uses, so the preview names the real recipient
    const billingEmail = (await this.resolveBillingRecipient(plan))?.email ?? null;

    return {
      ...draft,
      invoices: this.invoicesForDisplay(plan.metadata).slice(0, 12),
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

  /**
   * Who receives the church's invoices, in order: the billing admin (an app user), the church's
   * billing email (set by a pastor or admin), the pastor generating it, then the church's first
   * active pastor. Null when none exists.
   */
  async resolveBillingRecipient(
    plan: { id: string; billingAdminUserId?: string | null; metadata?: Record<string, unknown> | null; name: string },
    fallback?: { email: string; name: string },
  ): Promise<{ email: string; name: string; userId: string | null; source: string } | null> {
    if (plan.billingAdminUserId) {
      const billingAdmin = await AppDataSource.getRepository(User).findOne({
        where: { id: plan.billingAdminUserId },
        select: ['id', 'email', 'firstName', 'lastName'],
      });
      if (billingAdmin?.email) {
        const name = `${billingAdmin.firstName ?? ''} ${billingAdmin.lastName ?? ''}`.trim() || plan.name;
        return { email: billingAdmin.email, name, userId: billingAdmin.id, source: 'billing_admin' };
      }
    }
    const billingEmail = typeof plan.metadata?.billingEmail === 'string' ? plan.metadata.billingEmail.trim() : '';
    if (billingEmail) return { email: billingEmail, name: plan.name, userId: null, source: 'billing_email' };
    if (fallback?.email) return { ...fallback, userId: null, source: 'portal_user' };

    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { orgPlanId: plan.id },
      select: ['id'],
    });
    if (portal) {
      const pastor = await AppDataSource.getRepository(ChurchPortalUser).findOne({
        where: { churchPortalId: portal.id, isActive: true, password: Not(IsNull()) },
        select: ['id', 'email', 'firstName', 'lastName', 'role'],
        order: { createdAt: 'ASC' },
      });
      if (pastor?.email) {
        const name = `${pastor.firstName ?? ''} ${pastor.lastName ?? ''}`.trim() || plan.name;
        return { email: pastor.email, name, userId: null, source: 'pastor' };
      }
    }
    return null;
  }

  private async createChurchPlanInvoice(opts: {
    planId: string;
    actor: BillingActor;
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
      const recipient = await this.resolveBillingRecipient(plan, opts.fallbackRecipient);
      if (!recipient) {
        throw new AppError(
          'No billing email is set for this church. Add one in the church billing settings.',
          400,
        );
      }
      ({ email, name, userId } = recipient);
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

    await this.saveInvoiceRecord(
      opts.planId,
      { id: invoice.invoiceId },
      {
        status: toInvoiceStatus(invoice.status) ?? 'open',
        totalCents: invoice.totalCents,
        createdAt: invoice.createdAt,
        dueAt: invoice.dueAt,
        paidAt: null,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl,
        generatedBy: opts.actor.kind,
      },
    ).catch((err) =>
      // The invoice is already sent; the daily reconcile or a webhook will fill the record in
      logger.error('Failed to record church invoice', err instanceof Error ? err : new Error(String(err)), {
        planId: opts.planId,
        invoiceId: invoice.invoiceId,
      }),
    );

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

  // ─── Central church invoice tracking ──────────────────────────────────────────

  /** Insert/merge one invoice record on the plan (row-locked). Returns it with its previous status. */
  private async saveInvoiceRecord(
    planId: string,
    update: Partial<ChurchInvoiceRecord> & { id: string },
    fallback: Omit<ChurchInvoiceRecord, 'id'>,
  ): Promise<{ record: ChurchInvoiceRecord; previousStatus: ChurchInvoiceStatus | null; planName: string } | null> {
    return AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrgPlan);
      const plan = await repo.findOne({ where: { id: planId }, lock: { mode: 'pessimistic_write' } });
      if (!plan) return null;
      const before = readInvoiceRecords(plan.metadata);
      const previousStatus = before.find((r) => r.id === update.id)?.status ?? null;
      const list = upsertInvoiceRecord(before, update, fallback);
      plan.metadata = { ...(plan.metadata ?? {}), invoices: list };
      await repo.save(plan);
      const record = list.find((r) => r.id === update.id);
      return record ? { record, previousStatus, planName: plan.name } : null;
    });
  }

  private invoiceUpdateFromStripe(invoice: any): Partial<ChurchInvoiceRecord> & { id: string } {
    const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : undefined);
    return {
      id: invoice.id,
      status: toInvoiceStatus(invoice.status) ?? undefined,
      totalCents: typeof invoice.total === 'number' ? invoice.total : undefined,
      dueAt: iso(invoice.due_date),
      paidAt: iso(invoice.status_transitions?.paid_at),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    };
  }

  private invoiceFallbackFromStripe(invoice: any): Omit<ChurchInvoiceRecord, 'id'> {
    const generatedBy = invoice.metadata?.generatedBy;
    return {
      status: toInvoiceStatus(invoice.status) ?? 'open',
      totalCents: typeof invoice.total === 'number' ? invoice.total : 0,
      createdAt: new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      dueAt: null,
      paidAt: null,
      hostedInvoiceUrl: null,
      generatedBy:
        generatedBy === 'admin' || generatedBy === 'church_portal' || generatedBy === 'system' ? generatedBy : 'stripe',
    };
  }

  /**
   * Stripe webhook for a central church invoice (metadata.planType = church). These must never
   * reach the personal-subscription handlers: the invoice customer is looked up by billing
   * email, which can be an app user's own Stripe customer.
   */
  async recordChurchInvoiceFromStripe(invoice: any, eventType: string): Promise<void> {
    const planId = invoice?.metadata?.orgPlanId;
    if (!planId || !isUuid(planId) || !invoice.id) return;

    const update = this.invoiceUpdateFromStripe(invoice);
    if (eventType === 'invoice.payment_failed') update.paymentFailedAt = new Date().toISOString();

    const saved = await this.saveInvoiceRecord(planId, update, this.invoiceFallbackFromStripe(invoice));
    if (!saved) return;

    const { record, previousStatus, planName } = saved;
    const amount = `€${(record.totalCents / 100).toFixed(2)}`;
    const alert = (title: string) =>
      void adminAlertService.notify('subscription', {
        title,
        body: `${planName} · ${amount}`,
        link: `/subscriptions/church/${planId}`,
      });

    if (record.status === 'paid' && previousStatus !== 'paid') alert('Church invoice paid');
    else if (eventType === 'invoice.payment_failed') alert('Church invoice payment failed');
    else if (record.status === 'uncollectible' && previousStatus !== 'uncollectible') {
      alert('Church invoice marked uncollectible');
    }
  }

  /**
   * Daily: refresh open church invoices from Stripe (covers webhooks that were missed or not
   * enabled, and invoices marked paid by hand in Stripe), then alert super admins once for each
   * invoice that is past due. Nothing is cut off automatically; that stays an admin decision.
   */
  async reconcileChurchInvoices(now: Date = new Date()): Promise<{ checked: number; overdueAlerts: number }> {
    const plans = await AppDataSource.getRepository(OrgPlan).find({
      where: { planType: CHURCH_PLAN_TYPE },
      select: ['id', 'name', 'metadata'],
    });
    let checked = 0;
    let overdueAlerts = 0;

    for (const plan of plans) {
      for (const rec of readInvoiceRecords(plan.metadata).filter((r) => r.status === 'open')) {
        checked++;
        let current = rec;
        try {
          const invoice = await stripeService.stripe.invoices.retrieve(rec.id);
          const saved = await this.saveInvoiceRecord(plan.id, this.invoiceUpdateFromStripe(invoice), this.invoiceFallbackFromStripe(invoice));
          if (saved) {
            current = saved.record;
            if (current.status === 'paid' && saved.previousStatus !== 'paid') {
              void adminAlertService.notify('subscription', {
                title: 'Church invoice paid',
                body: `${plan.name} · €${(current.totalCents / 100).toFixed(2)}`,
                link: `/subscriptions/church/${plan.id}`,
              });
            }
          }
        } catch (err) {
          logger.warn('Church invoice reconcile: Stripe lookup failed', {
            planId: plan.id,
            invoiceId: rec.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        if (invoiceDisplayStatus(current, now) === 'overdue' && !current.overdueAlertedAt) {
          await this.saveInvoiceRecord(plan.id, { id: rec.id, overdueAlertedAt: now.toISOString() }, { ...current });
          overdueAlerts++;
          void adminAlertService.notify('subscription', {
            title: 'Church invoice overdue',
            body: `${plan.name} · €${(current.totalCents / 100).toFixed(2)} was due ${current.dueAt?.slice(0, 10)}`,
            link: `/subscriptions/church/${plan.id}`,
          });
        }
      }
    }
    return { checked, overdueAlerts };
  }

  /** Invoice history for the admin plan page and the pastor billing page */
  invoicesForDisplay(metadata: Record<string, unknown> | null | undefined, now: Date = new Date()) {
    return readInvoiceRecords(metadata).map((r) => ({
      id: r.id,
      status: invoiceDisplayStatus(r, now),
      totalCents: r.totalCents,
      createdAt: r.createdAt,
      dueAt: r.dueAt,
      paidAt: r.paidAt,
      hostedInvoiceUrl: r.hostedInvoiceUrl,
      generatedBy: r.generatedBy,
      paymentFailedAt: r.paymentFailedAt ?? null,
    }));
  }

  async generateFamilyInvoice(planId: string, adminUserId: string, ip?: string) {
    // Family members each have their own Stripe subscription charged to the parent's card, so
    // an extra invoice for the same members billed the parent twice. Disabled on purpose.
    if (planId) {
      throw new AppError(
        "Family plans are billed by each member's own subscription on the parent's card; a separate invoice would charge them twice.",
        410,
      );
    }
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

      if (plan.totalSeats > 0 && plan.usedSeats >= plan.totalSeats) {
        throw new AppError('Church plan has no available seats', 409);
      }

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
        const memberTiers = plan.metadata?.memberTiers as Record<string, string> | undefined;
        if (memberTiers && userId in memberTiers) {
          const { [userId]: _removed, ...rest } = memberTiers;
          plan.metadata = { ...(plan.metadata ?? {}), memberTiers: rest };
        }
        await planRepo.save(plan);
      }
    });
  }

  /**
   * End everything a church plan pays for: frees the seat and, for church-billed members
   * (`church_central`), downgrades the subscription to free. Members on the older flow who pay
   * through their own Stripe subscription keep it. No-op unless the user is on `planId`.
   */
  async endChurchPaidAccess(userId: string, planId: string): Promise<{ released: boolean; downgraded: boolean }> {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'orgPlanId'],
    });
    if (!user || user.orgPlanId !== planId) return { released: false, downgraded: false };

    await this.releaseChurchMembership(userId);

    const sub = await AppDataSource.getRepository(UserSubscription).findOne({ where: { userId } });
    if (sub?.externalProvider !== 'church_central') return { released: true, downgraded: false };

    // Sends the usual "subscription ended" email
    await subscriptionService.upsertSubscription(userId, {
      tier: 'free',
      status: 'active',
      externalProvider: null,
      externalRef: null,
      mrrCents: null,
      expiresAt: null,
      billingInterval: null,
      notes: null,
    });
    return { released: true, downgraded: true };
  }

  /** endChurchPaidAccess for the plan linked to a church portal (when a member leaves or is removed). */
  async endChurchPaidAccessForPortal(userId: string, churchPortalId: string) {
    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
      where: { id: churchPortalId },
      select: ['id', 'orgPlanId'],
    });
    if (!portal?.orgPlanId) return { released: false, downgraded: false };
    return this.endChurchPaidAccess(userId, portal.orgPlanId);
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
    // Was releaseChurchMembership alone, which left church-billed members on their paid tier
    const ended = await this.endChurchPaidAccess(userId, planId);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.remove_member',
      targetType: 'user',
      targetId: userId,
      metadata: { planId, churchBilledAccessEnded: ended.downgraded },
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
