import { In } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import {
  UserSubscription,
  type SubscriptionTier,
  type SubscriptionStatus,
} from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { adminAuditService } from './adminAudit.service';

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

    return {
      ...base,
      revenue: { totalMrrCents, currency: 'USD' },
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
}

export const adminSubscriptionService = new AdminSubscriptionService();
