import { Brackets } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { AppError } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { AdminUser } from '@/database/entities/adminUser.entity';
import { AdminAuthService } from './adminAuth.service';
import { adminAuditService } from './adminAudit.service';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

export class AdminAdminUserService {
  private repo = AppDataSource.getRepository(AdminUser);

  private serialize(row: AdminUser) {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(params: {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    role?: ADMIN_ROLE;
    isActive?: boolean;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('a');

    if (params.role) {
      qb.andWhere('a.role = :role', { role: params.role });
    }
    if (params.isActive !== undefined) {
      qb.andWhere('a.isActive = :isActive', { isActive: params.isActive });
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim().replace(/[%_\\]/g, '')}%`;
      if (term.length > 2) {
        qb.andWhere(
          new Brackets((w) => {
            w.where('a.email LIKE :s', { s: term });
          })
        );
      }
    }

    const order = this.parseSort(params.sort);
    qb.orderBy(order.field, order.direction);

    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(limit).getMany();

    return {
      data: rows.map((r) => this.serialize(r)),
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
      createdAt: 'a.createdAt',
      updatedAt: 'a.updatedAt',
      email: 'a.email',
      role: 'a.role',
    };
    return { field: map[key] || 'a.createdAt', direction };
  }

  async create(
    input: { email: string; password: string; role: ADMIN_ROLE },
    actorAdminUserId: string,
    ip?: string
  ) {
    const email = input.email.trim().toLowerCase();
    const exists = await this.repo.findOne({ where: { email } });
    if (exists) {
      throw new AppError('Admin user already exists', 409);
    }

    const hash = await AdminAuthService.hashPassword(input.password);
    const row = this.repo.create({
      email,
      password: hash,
      role: input.role,
      isActive: true,
    });
    const saved = await this.repo.save(row);

    await adminAuditService.log({
      adminUserId: actorAdminUserId,
      action: 'admin.admin_user.create',
      targetType: 'admin_user',
      targetId: saved.id,
      metadata: { email: saved.email, role: saved.role },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async setActive(
    adminUserId: string,
    isActive: boolean,
    actorAdminUserId: string,
    ip?: string
  ) {
    if (!isUuid(adminUserId)) {
      throw new AppError('Invalid admin user id', 400);
    }
    const row = await this.repo.findOne({ where: { id: adminUserId } });
    if (!row) {
      throw new AppError('Admin user not found', 404);
    }

    if (!isActive && row.id === actorAdminUserId) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    row.isActive = isActive;
    const saved = await this.repo.save(row);

    await adminAuditService.log({
      adminUserId: actorAdminUserId,
      action: 'admin.admin_user.set_active',
      targetType: 'admin_user',
      targetId: saved.id,
      metadata: { isActive: saved.isActive },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async resetPassword(
    adminUserId: string,
    password: string,
    actorAdminUserId: string,
    ip?: string
  ) {
    if (!isUuid(adminUserId)) {
      throw new AppError('Invalid admin user id', 400);
    }
    const row = await this.repo.findOne({
      where: { id: adminUserId },
      select: ['id', 'email', 'role', 'isActive', 'password'],
    });
    if (!row) {
      throw new AppError('Admin user not found', 404);
    }

    row.password = await AdminAuthService.hashPassword(password);
    await this.repo.save(row);

    await adminAuditService.log({
      adminUserId: actorAdminUserId,
      action: 'admin.admin_user.reset_password',
      targetType: 'admin_user',
      targetId: row.id,
      metadata: { email: row.email },
      ip: ip ?? null,
    });

    return { ok: true };
  }
}

export const adminAdminUserService = new AdminAdminUserService();
