import { Brackets } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserDiscount } from '@/database/entities/userDiscount.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { AppError, USER_ROLE } from '@/common';
import { adminAuditService } from './adminAudit.service';
import { adminSubscriptionService } from './adminSubscription.service';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

export class AdminUserService {
  async listUsers(params: {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    role?: 'mentee' | 'mentor' | 'all';
    country?: string;
    churchSearch?: string;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = AppDataSource.getRepository(User).createQueryBuilder('user');

    const roleFilter = params.role ?? 'all';
    if (roleFilter === 'mentee') {
      qb.andWhere('user.role = :r', { r: USER_ROLE.MENTEE });
    } else if (roleFilter === 'mentor') {
      qb.andWhere('user.role = :r', { r: USER_ROLE.MENTOR });
    }

    if (params.country) {
      qb.andWhere('user.country = :country', { country: params.country });
    }

    if (params.churchSearch?.trim()) {
      const c = `%${params.churchSearch.trim().replace(/[%_\\]/g, '')}%`;
      if (c.length > 2) {
        qb.andWhere(
          new Brackets((w) => {
            w.where(
              `user.id IN (SELECT userId FROM mentee_profiles WHERE churchName LIKE :c)`,
              { c }
            ).orWhere(
              `user.id IN (SELECT userId FROM mentor_profiles WHERE churchAffiliation LIKE :c)`,
              { c }
            );
          })
        );
      }
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim().replace(/[%_\\]/g, '')}%`;
      if (term.length > 2) {
        qb.andWhere(
          new Brackets((w) => {
            w.where('user.email LIKE :s', { s: term })
              .orWhere('user.firstName LIKE :s', { s: term })
              .orWhere('user.lastName LIKE :s', { s: term });
          })
        );
      }
    }

    const order = this.parseSort(params.sort);
    qb.orderBy(order.field, order.direction);

    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(limit).getMany();

    const data = rows.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      country: u.country,
      role: u.role,
      accountStatus: u.accountStatus,
      isActive: u.isActive,
      isOnboardingComplete: u.isOnboardingComplete,
      mentorApprovalStatus: u.mentorApprovalStatus,
      createdAt: u.createdAt,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private parseSort(sort?: string): { field: string; direction: 'ASC' | 'DESC' } {
    const direction: 'ASC' | 'DESC' = sort?.startsWith('-') ? 'DESC' : 'ASC';
    const key = sort?.replace(/^-/, '') || 'createdAt';
    const map: Record<string, string> = {
      createdAt: 'user.createdAt',
      updatedAt: 'user.updatedAt',
      email: 'user.email',
    };
    return { field: map[key] || 'user.createdAt', direction };
  }

  async getUserDetail(userId: string) {
    if (!isUuid(userId)) {
      throw new AppError('Invalid user id', 400);
    }
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const discountRepo = AppDataSource.getRepository(UserDiscount);
    const discounts = await discountRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    let menteeProfile: MenteeProfile | null = null;
    let mentorProfile: MentorProfile | null = null;
    if (user.role === USER_ROLE.MENTEE) {
      menteeProfile = await AppDataSource.getRepository(MenteeProfile).findOne({
        where: { userId },
      });
    } else if (user.role === USER_ROLE.MENTOR) {
      mentorProfile = await AppDataSource.getRepository(MentorProfile).findOne({
        where: { userId },
      });
    }

    const { password: _p, ...safeUser } = user as User & {
      password?: string;
    };

    const subscription = await adminSubscriptionService.findForUser(userId);

    return {
      user: safeUser,
      menteeProfile,
      mentorProfile,
      discounts: discounts.map((d) => this.serializeDiscount(d)),
      subscription: subscription
        ? adminSubscriptionService.serialize(subscription)
        : null,
      subscriptionHistory: [] as unknown[],
    };
  }

  serializeDiscount(d: UserDiscount) {
    return {
      id: d.id,
      userId: d.userId,
      type: d.discountType,
      value: parseFloat(d.value),
      label: d.label,
      validFrom: d.validFrom,
      validUntil: d.validUntil,
      createdAt: d.createdAt,
      createdByAdminId: d.createdByAdminId,
    };
  }

  async addDiscount(
    userId: string,
    input: {
      type: 'percent' | 'fixed';
      value: number;
      label?: string;
      validFrom?: string;
      validUntil?: string | null;
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

    if (input.type === 'percent' && input.value > 100) {
      throw new AppError('Percent discount cannot exceed 100', 400);
    }

    const repo = AppDataSource.getRepository(UserDiscount);
    const row = repo.create({
      userId,
      discountType: input.type,
      value: String(input.value),
      label: input.label ?? null,
      validFrom: input.validFrom ? new Date(input.validFrom) : null,
      validUntil:
        input.validUntil === undefined ||
        input.validUntil === null ||
        input.validUntil === ''
          ? null
          : new Date(input.validUntil),
      createdByAdminId: adminUserId,
    });
    const saved = await repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.user.discount.create',
      targetType: 'user',
      targetId: userId,
      metadata: { discountId: saved.id, type: input.type },
      ip: ip ?? null,
    });

    return this.serializeDiscount(saved);
  }

  async removeDiscount(
    userId: string,
    discountId: string,
    adminUserId: string,
    ip?: string
  ) {
    if (!isUuid(userId) || !isUuid(discountId)) {
      throw new AppError('Invalid id', 400);
    }
    const repo = AppDataSource.getRepository(UserDiscount);
    const row = await repo.findOne({ where: { id: discountId, userId } });
    if (!row) {
      throw new AppError('Discount not found', 404);
    }
    await repo.remove(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.user.discount.delete',
      targetType: 'user',
      targetId: userId,
      metadata: { discountId },
      ip: ip ?? null,
    });

    return { deleted: true, id: discountId };
  }
}

export const adminUserService = new AdminUserService();
