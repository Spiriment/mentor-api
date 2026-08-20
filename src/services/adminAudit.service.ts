import { AppDataSource } from '@/config/data-source';
import { AdminAuditLog } from '@/database/entities/adminAuditLog.entity';
import { AdminUser } from '@/database/entities/adminUser.entity';

export type AdminAuditInput = {
  adminUserId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
};

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

class AdminAuditService {
  private repo = AppDataSource.getRepository(AdminAuditLog);

  async log(input: AdminAuditInput): Promise<void> {
    const row = this.repo.create({
      adminUserId: input.adminUserId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
    });
    await this.repo.save(row);
  }

  async listLogs(params: {
    page?: number;
    limit?: number;
    adminUserId?: string;
    action?: string;
    targetType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.adminUserId) {
      qb.andWhere('log.adminUserId = :adminUserId', {
        adminUserId: params.adminUserId,
      });
    }

    if (params.action?.trim()) {
      const term = `%${params.action.trim().replace(/[%_\\]/g, '')}%`;
      qb.andWhere('log.action LIKE :action', { action: term });
    }

    if (params.targetType) {
      qb.andWhere('log.targetType = :targetType', {
        targetType: params.targetType,
      });
    }

    if (params.dateFrom) {
      qb.andWhere('log.createdAt >= :dateFrom', {
        dateFrom: new Date(params.dateFrom),
      });
    }

    if (params.dateTo) {
      qb.andWhere('log.createdAt <= :dateTo', {
        dateTo: new Date(params.dateTo),
      });
    }

    const [rows, total] = await qb.getManyAndCount();

    const adminIds = [
      ...new Set(rows.map((r) => r.adminUserId).filter(Boolean)),
    ];
    const admins =
      adminIds.length === 0
        ? []
        : await AppDataSource.getRepository(AdminUser)
            .createQueryBuilder('a')
            .where('a.id IN (:...ids)', { ids: adminIds })
            .getMany();
    const adminById = new Map(admins.map((a) => [a.id, a]));

    const data = rows.map((row) => {
      const admin = adminById.get(row.adminUserId);
      const adminName = admin
        ? [admin.firstName, admin.lastName].filter(Boolean).join(' ').trim() ||
          admin.email
        : null;
      return {
        id: row.id,
        adminUserId: row.adminUserId,
        adminEmail: admin?.email ?? null,
        adminName,
        action: row.action,
        targetType: row.targetType ?? null,
        targetId: row.targetId ?? null,
        metadata: row.metadata ?? null,
        ip: row.ip ?? null,
        createdAt: row.createdAt,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const adminAuditService = new AdminAuditService();
