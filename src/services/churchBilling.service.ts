import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/int-services';
import { AppError } from '@/common';
import { User } from '@/database/entities/user.entity';
import { OrgPlan } from '@/database/entities/orgPlan.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { ChurchPortal, CHURCH_PORTAL_STATUS } from '@/church-portal/entities/churchPortal.entity';
import {
  TIER_PRICE_EUR,
  applyDiscount,
  getChurchDiscountPercentForMemberCount,
  CHURCH_PORTAL_MONTHLY_FEE_EUR,
} from '@/common/constants/subscriptionPricing';
import {
  isAutoInvoiceDue,
  readAutoInvoiceSettings,
  readInvoiceRecords,
  type AutoInvoiceSettings,
} from '@/common/churchBilling';
import { adminOrgPlanService, type BillingActor } from './adminOrgPlan.service';
import { adminAlertService } from './adminAlert.service';
import { notifyMemberCovered } from '@/church-portal/services/churchPortalNotifications';

export type PaidTier = 'basic' | 'pro' | 'premium';

/**
 * Churches pay for the members they choose, each on a tier (central monthly invoice: €50
 * portal fee + each covered member's tier at the church discount). Pastors manage this in
 * the church portal; Spiriment admins in the admin panel. Joining a church with its code only
 * gives the discount; being covered is a separate choice.
 */
export class ChurchBillingService {
  /** The church's billing plan, created on first use (no seat cap) */
  async ensurePlanForPortal(churchPortalId: string): Promise<string> {
    return AppDataSource.transaction(async (manager) => {
      const portalRepo = manager.getRepository(ChurchPortal);
      const portal = await portalRepo.findOne({
        where: { id: churchPortalId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!portal) throw new AppError('Church not found', 404);
      if (portal.orgPlanId) {
        const exists = await manager.getRepository(OrgPlan).exist({ where: { id: portal.orgPlanId } });
        if (exists) return portal.orgPlanId;
      }
      const planRepo = manager.getRepository(OrgPlan);
      const plan = await planRepo.save(
        planRepo.create({ planType: 'church', name: portal.name, status: 'active', totalSeats: 0, usedSeats: 0 }),
      );
      portal.orgPlanId = plan.id;
      await portalRepo.save(portal);
      logger.info('Church billing plan created', { churchPortalId, planId: plan.id });
      return plan.id;
    });
  }

  /** Members, who the church pays for, and the billing settings, for the billing screens */
  async getOverview(churchPortalId: string) {
    const planId = await this.ensurePlanForPortal(churchPortalId);
    const plan = await AppDataSource.getRepository(OrgPlan).findOneOrFail({ where: { id: planId } });
    const userRepo = AppDataSource.getRepository(User);
    const fields: (keyof User)[] = ['id', 'firstName', 'lastName', 'email', 'role', 'churchPortalId', 'orgPlanId'];

    // Church members, plus anyone on the plan who isn't (e.g. added by an admin, then left)
    const [members, coveredElsewhere] = await Promise.all([
      userRepo.find({ where: { churchPortalId }, select: fields, order: { firstName: 'ASC' } }),
      userRepo.find({ where: { orgPlanId: planId }, select: fields }),
    ]);
    const byId = new Map(members.map((m) => [m.id, m]));
    for (const u of coveredElsewhere) if (!byId.has(u.id)) byId.set(u.id, u);
    const users = Array.from(byId.values());

    const subs = users.length
      ? await AppDataSource.getRepository(UserSubscription).find({ where: { userId: In(users.map((u) => u.id)) } })
      : [];
    const subByUser = new Map(subs.map((s) => [s.userId, s]));
    const memberTiers = (plan.metadata?.memberTiers as Record<string, string> | undefined) ?? {};
    const discountPercent = getChurchDiscountPercentForMemberCount(members.length);

    const rows = users.map((u) => {
      const sub = subByUser.get(u.id);
      const covered = u.orgPlanId === planId;
      const tier = (covered ? (memberTiers[u.id] ?? sub?.tier) : null) as PaidTier | null;
      const paysOwn =
        !covered &&
        !!sub &&
        ['stripe', 'stripe_family', 'revenuecat'].includes(sub.externalProvider ?? '') &&
        ['active', 'past_due', 'trialing'].includes(sub.status) &&
        sub.tier !== 'free';
      return {
        id: u.id,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        email: u.email,
        role: u.role,
        inChurch: u.churchPortalId === churchPortalId,
        covered,
        tier,
        monthlyEur: covered && tier && TIER_PRICE_EUR[tier] ? applyDiscount(TIER_PRICE_EUR[tier], discountPercent) : null,
        /** Already pays for their own plan: must cancel before the church can cover them */
        ownPlan: paysOwn
          ? {
              tier: sub!.tier,
              via: sub!.externalProvider === 'revenuecat' ? 'App Store' : sub!.externalProvider === 'stripe_family' ? 'family plan' : 'card',
            }
          : null,
      };
    });

    const recipient = await adminOrgPlanService.resolveBillingRecipient(plan);
    return {
      planId,
      planStatus: plan.status,
      seatCap: plan.totalSeats > 0 ? plan.totalSeats : null,
      coveredCount: rows.filter((r) => r.covered).length,
      discountPercent,
      portalFeeEur: CHURCH_PORTAL_MONTHLY_FEE_EUR,
      tierPrices: TIER_PRICE_EUR,
      billingEmail: typeof plan.metadata?.billingEmail === 'string' ? plan.metadata.billingEmail : null,
      invoiceRecipient: recipient?.email ?? null,
      autoInvoice: readAutoInvoiceSettings(plan.metadata),
      members: rows,
    };
  }

  private async requireMemberOfChurch(churchPortalId: string, userId: string) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'churchPortalId', 'orgPlanId'],
    });
    if (!user) throw new AppError('Member not found', 404);
    return user;
  }

  async cover(churchPortalId: string, userId: string, tier: PaidTier, actor: BillingActor, ip?: string) {
    const user = await this.requireMemberOfChurch(churchPortalId, userId);
    if (user.churchPortalId !== churchPortalId) {
      throw new AppError('Only members of this church can be added to its plan', 400);
    }
    const planId = await this.ensurePlanForPortal(churchPortalId);
    const result = await adminOrgPlanService.assignMember(planId, userId, tier, actor, ip);
    const portal = await AppDataSource.getRepository(ChurchPortal).findOne({ where: { id: churchPortalId }, select: ['id', 'name'] });
    notifyMemberCovered(userId, portal?.name ?? 'Your church', tier);
    return result;
  }

  async changeTier(churchPortalId: string, userId: string, tier: PaidTier, actor: BillingActor, ip?: string) {
    await this.requireMemberOfChurch(churchPortalId, userId);
    const planId = await this.ensurePlanForPortal(churchPortalId);
    return adminOrgPlanService.changeMemberTier(planId, userId, tier, actor, ip);
  }

  /** Stop paying for a member: they move to Free (with an email); they stay in the church */
  async uncover(churchPortalId: string, userId: string, actor: BillingActor) {
    await this.requireMemberOfChurch(churchPortalId, userId);
    const planId = await this.ensurePlanForPortal(churchPortalId);
    const result = await adminOrgPlanService.endChurchPaidAccess(userId, planId);
    if (!result.released) throw new AppError('The church does not pay for this member', 400);
    logger.info('Church billing: stopped covering member', { churchPortalId, userId, actor });
    return result;
  }

  /**
   * Billing email (pastors and admins). Automatic invoicing and the seat cap are for Spiriment
   * admins only (callers enforce that).
   */
  async updateSettings(
    churchPortalId: string,
    input: { billingEmail?: string | null; autoInvoice?: AutoInvoiceSettings; seatCap?: number | null },
    actor: BillingActor,
  ) {
    const planId = await this.ensurePlanForPortal(churchPortalId);
    await AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OrgPlan);
      const plan = await repo.findOneOrFail({ where: { id: planId }, lock: { mode: 'pessimistic_write' } });
      const metadata: Record<string, unknown> = { ...(plan.metadata ?? {}) };
      if (input.billingEmail !== undefined) {
        const email = input.billingEmail?.trim().toLowerCase() || null;
        if (email) metadata.billingEmail = email;
        else delete metadata.billingEmail;
      }
      if (input.autoInvoice !== undefined) metadata.autoInvoice = input.autoInvoice;
      plan.metadata = metadata;
      if (input.seatCap !== undefined) {
        const cap = input.seatCap ?? 0;
        if (cap > 0 && cap < plan.usedSeats) {
          throw new AppError(`The church already pays for ${plan.usedSeats} members; the cap can't be lower.`, 400);
        }
        plan.totalSeats = cap;
      }
      await repo.save(plan);
    });
    logger.info('Church billing settings updated', { churchPortalId, actor, changed: Object.keys(input) });
    return this.getOverview(churchPortalId);
  }

  /**
   * Daily: send this month's invoice for churches with automatic invoicing on. Skips suspended
   * churches and alerts super admins when an invoice can't be sent.
   */
  async runAutoInvoices(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
    const plans = await AppDataSource.getRepository(OrgPlan).find({
      where: { planType: 'church', status: 'active' },
      select: ['id', 'name', 'metadata'],
    });
    let sent = 0;
    let failed = 0;

    for (const plan of plans) {
      if (!isAutoInvoiceDue(readAutoInvoiceSettings(plan.metadata), readInvoiceRecords(plan.metadata), now)) continue;

      const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
        where: { orgPlanId: plan.id },
        select: ['id', 'status'],
      });
      if (portal && portal.status !== CHURCH_PORTAL_STATUS.ACTIVE) continue;

      try {
        await adminOrgPlanService.generateChurchInvoiceAutomatically(plan.id);
        sent++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Automatic church invoice failed', err instanceof Error ? err : new Error(message), { planId: plan.id });
        // Once a day at most (this runs daily); keeps retrying until it goes out
        void adminAlertService.notify('subscription', {
          title: 'Church invoice could not be sent',
          body: `${plan.name} · ${message}`,
          link: `/subscriptions/church/${plan.id}`,
        });
      }
    }
    return { sent, failed };
  }
}

export const churchBillingService = new ChurchBillingService();
