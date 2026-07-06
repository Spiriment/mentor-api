import { In } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { OrgPlan } from '@/database/entities/orgPlan.entity';
import { FamilyPlan } from '@/database/entities/familyPlan.entity';
import {
  UserSubscription,
  type SubscriptionTier,
  type SubscriptionStatus,
} from '@/database/entities/userSubscription.entity';
import { PromoCode, type PromoCodeType } from '@/database/entities/promoCode.entity';
import { PromoCodeRedemption } from '@/database/entities/promoCodeRedemption.entity';
import { AppError } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminAuditService } from './adminAudit.service';
import { mrrSnapshotService } from './mrrSnapshot.service';
import {
  applyEntitledPaidTierFilters,
  applyMrrFilters,
  applyPayingSubscriberFilters,
  ENTITLED_STATUSES,
  PAYING_TIERS,
} from '@/common/constants/subscriptionMetrics';
import { CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';

const MAX_INTERNAL_TEST_CODES = 3;

export class AdminSubscriptionService {
  serialize(row: UserSubscription): Record<string, unknown> {
    const userId = row.userId ?? row.user?.id ?? undefined;
    return {
      id: row.id,
      userId,
      tier: row.tier,
      status: row.status,
      mrrCents: row.mrrCents ?? null,
      currency: row.currency,
      expiresAt: row.expiresAt ?? null,
      externalProvider: row.externalProvider ?? null,
      externalRef: row.externalRef ?? null,
      billingInterval: row.billingInterval ?? null,
      pastDueAt: row.pastDueAt ?? null,
      cancelAtPeriodEnd: row.notes === CANCEL_AT_PERIOD_END_NOTE,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findForUser(userId: string): Promise<UserSubscription | null> {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    const repo = AppDataSource.getRepository(UserSubscription);
    let row = await repo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!row) {
      row = await repo.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });
      if (row && !row.userId) {
        row.userId = userId;
        await repo.save(row);
      }
    }
    return row;
  }

  async getSummary(adminRole: ADMIN_ROLE) {
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const userRepo = AppDataSource.getRepository(User);

    const tierQb = subRepo
      .createQueryBuilder('s')
      .select('s.tier', 'tier')
      .addSelect('COUNT(*)', 'cnt');
    applyEntitledPaidTierFilters(tierQb, 's');
    const tierRows = await tierQb.groupBy('s.tier').getRawMany<{ tier: string; cnt: string }>();

    const countsByTier: Record<SubscriptionTier, number> = {
      free: 0,
      basic: 0,
      pro: 0,
      premium: 0,
      none: 0,
    };
    for (const r of tierRows) {
      const t = r.tier as SubscriptionTier;
      if (t in countsByTier) {
        countsByTier[t] = parseInt(r.cnt, 10);
      }
    }

    const [totalUsers, activeSubscribersRow] = await Promise.all([
      userRepo.count(),
      (async () => {
        const countQb = subRepo.createQueryBuilder('s').select('COUNT(*)', 'cnt');
        applyPayingSubscriberFilters(countQb, 's');
        return countQb.getRawOne<{ cnt: string }>();
      })(),
    ]);
    const activeSubscribers = activeSubscribersRow?.cnt
      ? parseInt(activeSubscribersRow.cnt, 10)
      : 0;

    const distinctRow = await subRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.userId)', 'c')
      .getRawOne<{ c: string }>();
    const usersWithSubscriptionRow = distinctRow?.c
      ? parseInt(distinctRow.c, 10)
      : 0;
    const usersWithoutSubscriptionRecord = Math.max(
      0,
      totalUsers - usersWithSubscriptionRow
    );

    const base = {
      countsByTier,
      totalUsers,
      activeSubscribers,
      usersWithoutSubscriptionRecord,
    };

    if (adminRole !== ADMIN_ROLE.SUPER_ADMIN) {
      return {
        ...base,
        revenue: null,
        revenueNote:
          'MRR and revenue aggregates are visible to Super Admins only.',
        metricsNote:
          'Tier counts include trialing users. MRR is Super Admin only.',
      };
    }

    const mrrQb = subRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.mrrCents), 0)', 'sum');
    applyMrrFilters(mrrQb, 's');
    mrrQb.andWhere('s.mrrCents IS NOT NULL');
    const mrrRow = await mrrQb.getRawOne<{ sum: string }>();

    const unknownMrrQb = subRepo.createQueryBuilder('s').select('COUNT(*)', 'cnt');
    applyMrrFilters(unknownMrrQb, 's');
    unknownMrrQb.andWhere('s.mrrCents IS NULL');
    const unknownMrrRow = await unknownMrrQb.getRawOne<{ cnt: string }>();
    const mrrUnknownSubscriberCount = unknownMrrRow?.cnt
      ? parseInt(unknownMrrRow.cnt, 10)
      : 0;

    const totalMrrCents = mrrRow?.sum ? parseInt(mrrRow.sum, 10) : 0;
    const revenueHistory = await this.getRevenueHistory();

    const orgRepo = AppDataSource.getRepository(OrgPlan);
    const familyPlanRepo = AppDataSource.getRepository(FamilyPlan);
    const [activeChurchPlans, activeFamilyPlans] = await Promise.all([
      orgRepo.count({ where: { planType: 'church', status: 'active' } }),
      familyPlanRepo.count({ where: { status: 'active' } }),
    ]);

    return {
      ...base,
      revenue: {
        totalMrrCents,
        currency: 'EUR',
        history: revenueHistory,
        mrrUnknownSubscriberCount,
      },
      activePlans: { church: activeChurchPlans, family: activeFamilyPlans },
      revenueNote:
        mrrUnknownSubscriberCount > 0
          ? `${mrrUnknownSubscriberCount} paying subscriber(s) have unknown MRR and are excluded from the total.`
          : null,
      metricsNote:
        'Tier counts include trialing users. MRR and paying subscribers count active and past_due paid tiers only.',
    };
  }

  async getDashboardSubscriptionSlice(adminRole: ADMIN_ROLE) {
    const full = await this.getSummary(adminRole);
    return {
      basic: full.countsByTier.basic,
      pro: full.countsByTier.pro,
      premium: full.countsByTier.premium,
      none: full.countsByTier.none,
      activeSubscribers: full.activeSubscribers,
      ...(adminRole === ADMIN_ROLE.SUPER_ADMIN && full.revenue
        ? { totalMrrCents: full.revenue.totalMrrCents }
        : {}),
    };
  }

  async getRevenueHistory() {
    return mrrSnapshotService.getRevenueHistory(12);
  }

  async upsertForUser(
    userId: string,
    input: {
      tier: SubscriptionTier;
      status: SubscriptionStatus;
      mrrCents?: number | null;
      currency?: string;
      expiresAt?: string | null;
      externalProvider?: string | null;
      externalRef?: string | null;
      notes?: string | null;
      billingInterval?: 'monthly' | 'annual' | null;
      pastDueAt?: string | null;
    },
    adminUserId: string,
    ip?: string
  ) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const repo = AppDataSource.getRepository(UserSubscription);
    let row = await this.findForUser(userId);

    const resolveExpiresAt = (): Date | null => {
      if (
        input.expiresAt === undefined ||
        input.expiresAt === null ||
        input.expiresAt === ''
      ) {
        return null;
      }
      return new Date(input.expiresAt);
    };

    if (!row) {
      row = repo.create({
        userId,
        user: { id: userId } as User,
        tier: input.tier,
        status: input.status,
        mrrCents:
          input.mrrCents === undefined ? null : input.mrrCents,
        currency: input.currency ?? 'EUR',
        expiresAt: resolveExpiresAt(),
        externalProvider: input.externalProvider ?? null,
        externalRef: input.externalRef ?? null,
        notes: input.notes ?? null,
        billingInterval: input.billingInterval ?? null,
        pastDueAt:
          input.pastDueAt === undefined || input.pastDueAt === null || input.pastDueAt === ''
            ? null
            : new Date(input.pastDueAt),
      });
    } else {
      row.userId = userId;
      row.tier = input.tier;
      row.status = input.status;
      if (input.mrrCents !== undefined) {
        row.mrrCents = input.mrrCents;
      }
      if (input.currency !== undefined) {
        row.currency = input.currency;
      }
      if (input.expiresAt !== undefined) {
        row.expiresAt = resolveExpiresAt();
      }
      if (input.externalProvider !== undefined) {
        row.externalProvider = input.externalProvider;
      }
      if (input.externalRef !== undefined) {
        row.externalRef = input.externalRef;
      }
      if (input.notes !== undefined) {
        row.notes = input.notes;
      }
      if (input.billingInterval !== undefined) {
        row.billingInterval = input.billingInterval;
      }
      if (input.pastDueAt !== undefined) {
        row.pastDueAt =
          input.pastDueAt === null || input.pastDueAt === ''
            ? null
            : new Date(input.pastDueAt);
      }
    }

    const saved = await repo.save(row);
    const withUser = await repo.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });

    await adminAuditService.log({
      adminUserId,
      action: 'admin.user.subscription.upsert',
      targetType: 'user',
      targetId: userId,
      metadata: { tier: input.tier, status: input.status },
      ip: ip ?? null,
    });

    return this.serialize(withUser!);
  }

  async listIndividualSubscribers(page = 1, limit = 50) {
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const qb = subRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .where('s.status IN (:...statuses)', { statuses: ENTITLED_STATUSES })
      .andWhere('s.tier IN (:...tiers)', { tiers: PAYING_TIERS })
      .andWhere('user.orgPlanId IS NULL')
      .andWhere('(s.externalProvider IS NULL OR s.externalProvider != :stripeFamily)', {
        stripeFamily: 'stripe_family',
      })
      .orderBy('s.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((r) => ({
        ...this.serialize(r),
        userName: r.user
          ? `${r.user.firstName} ${r.user.lastName}`.trim() || 'No Name'
          : 'Unknown',
        userEmail: r.user?.email,
        userRole: r.user?.role ?? 'mentee',
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Promo codes ─────────────────────────────────────────────────────────────

  private get promoRepo() {
    return AppDataSource.getRepository(PromoCode);
  }

  private get redemptionRepo() {
    return AppDataSource.getRepository(PromoCodeRedemption);
  }

  private serializePromo(p: PromoCode, redemptionCount?: number) {
    return {
      id: p.id,
      code: p.code,
      type: p.type,
      discountPercent: p.discountPercent,
      tier: p.tier,
      usageLimit: p.usageLimit ?? null,
      usedCount: p.usedCount,
      expiresAt: p.expiresAt ?? null,
      isActive: p.isActive,
      notes: p.notes ?? null,
      redemptionCount: redemptionCount ?? p.usedCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async createPromoCode(
    input: {
      type: PromoCodeType;
      discountPercent?: number;
      tier?: string;
      usageLimit?: number | null;
      expiresAt?: string | null;
      notes?: string | null;
    },
    adminUserId: string,
    ip?: string,
  ) {
    if (input.type === 'internal_test') {
      const existingCount = await this.promoRepo.count({
        where: { type: 'internal_test', isActive: true },
      });
      if (existingCount >= MAX_INTERNAL_TEST_CODES) {
        throw new AppError(
          `Maximum of ${MAX_INTERNAL_TEST_CODES} active internal test codes allowed`,
          400,
        );
      }
    }

    const code = this.generateCode(input.type);

    const promo = this.promoRepo.create({
      code,
      type: input.type,
      discountPercent: input.type === 'internal_test' ? 100 : (input.discountPercent ?? 20),
      tier: input.tier ?? 'premium',
      usageLimit: input.usageLimit ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: true,
      notes: input.notes ?? null,
    });

    const saved = await this.promoRepo.save(promo);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.promo_code.create',
      targetType: 'promo_code',
      targetId: saved.id,
      metadata: { code: saved.code, type: saved.type },
      ip: ip ?? null,
    });

    return this.serializePromo(saved);
  }

  async listPromoCodes(page = 1, limit = 50, type?: PromoCodeType) {
    const where: any = {};
    if (type) where.type = type;

    const [rows, total] = await this.promoRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: rows.map((p) => this.serializePromo(p)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updatePromoCode(
    id: string,
    input: {
      discountPercent?: number;
      tier?: string;
      usageLimit?: number | null;
      expiresAt?: string | null;
      isActive?: boolean;
      notes?: string | null;
    },
    adminUserId: string,
    ip?: string,
  ) {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new AppError('Promo code not found', 404);

    if (input.discountPercent !== undefined && promo.type !== 'internal_test') {
      promo.discountPercent = input.discountPercent;
    }
    if (input.tier !== undefined) promo.tier = input.tier;
    if (input.usageLimit !== undefined) promo.usageLimit = input.usageLimit;
    if (input.expiresAt !== undefined) {
      promo.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }
    if (input.isActive !== undefined) promo.isActive = input.isActive;
    if (input.notes !== undefined) promo.notes = input.notes;

    const saved = await this.promoRepo.save(promo);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.promo_code.update',
      targetType: 'promo_code',
      targetId: saved.id,
      metadata: { isActive: saved.isActive },
      ip: ip ?? null,
    });

    return this.serializePromo(saved);
  }

  private generateCode(type: PromoCodeType): string {
    const prefix = type === 'internal_test' ? 'INT' : 'AMB';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 8; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${prefix}-${suffix}`;
  }
}

export const adminSubscriptionService = new AdminSubscriptionService();
