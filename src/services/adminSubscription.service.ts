import { In, IsNull } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
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

const MAX_INTERNAL_TEST_CODES = 3;

const ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

export class AdminSubscriptionService {
  serialize(row: UserSubscription): Record<string, unknown> {
    const userId =
      row.user?.id ??
      (row as unknown as { userId?: string }).userId ??
      undefined;
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
      notes: row.notes ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findForUser(userId: string): Promise<UserSubscription | null> {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    return AppDataSource.getRepository(UserSubscription).findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async getSummary(adminRole: ADMIN_ROLE) {
    const subRepo = AppDataSource.getRepository(UserSubscription);
    const userRepo = AppDataSource.getRepository(User);

    const tierRows = await subRepo
      .createQueryBuilder('s')
      .select('s.tier', 'tier')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.status IN (:...st)', { st: ACTIVE_STATUSES })
      .groupBy('s.tier')
      .getRawMany<{ tier: string; cnt: string }>();

    const countsByTier: Record<SubscriptionTier, number> = {
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

    const [totalUsers, activeSubscribers] = await Promise.all([
      userRepo.count(),
      subRepo.count({ where: { status: In(ACTIVE_STATUSES) } }),
    ]);

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
      };
    }

    const mrrRow = await subRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.mrrCents), 0)', 'sum')
      .where('s.status IN (:...st)', { st: ACTIVE_STATUSES })
      .getRawOne<{ sum: string }>();

    const totalMrrCents = mrrRow?.sum ? parseInt(mrrRow.sum, 10) : 0;
    const revenueHistory = await this.getRevenueHistory();

    return {
      ...base,
      revenue: { totalMrrCents, currency: 'USD', history: revenueHistory },
      revenueNote: null,
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
    // Generate mock data for the last 12 months as requested
    const now = new Date();
    const history = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Starting point for our mock growth
    const baseRevenueCents = 1200000; // $12,000.00
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = months[d.getMonth()];
      
      // Artificial growth pattern: 2-5% growth each month + random noise
      const growthFactor = Math.pow(1.04, 11 - i); 
      const noise = 0.95 + (Math.random() * 0.1); // +/- 5%
      const amount = Math.floor(baseRevenueCents * growthFactor * noise);
      
      history.push({
        month: monthLabel,
        year: d.getFullYear(),
        revenueCents: amount,
      });
    }
    return history;
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
    let row = await repo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });

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
        user: { id: userId } as User,
        tier: input.tier,
        status: input.status,
        mrrCents:
          input.mrrCents === undefined ? null : input.mrrCents,
        currency: input.currency ?? 'USD',
        expiresAt: resolveExpiresAt(),
        externalProvider: input.externalProvider ?? null,
        externalRef: input.externalRef ?? null,
        notes: input.notes ?? null,
      });
    } else {
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
    const [rows, total] = await subRepo.findAndCount({
      where: {
        status: In(ACTIVE_STATUSES),
        user: { orgPlanId: IsNull() },
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: rows.map((r) => ({
        ...this.serialize(r),
        userName: r.user
          ? `${r.user.firstName} ${r.user.lastName}`.trim() || 'No Name'
          : 'Unknown',
        userEmail: r.user?.email,
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
