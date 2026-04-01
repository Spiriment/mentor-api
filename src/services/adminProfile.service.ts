import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { AppError } from '@/common';
import { AdminUser } from '@/database/entities/adminUser.entity';
import { adminAuditService } from './adminAudit.service';

export class AdminProfileService {
  private repo = AppDataSource.getRepository(AdminUser);

  private serialize(admin: AdminUser) {
    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      firstName: admin.firstName ?? null,
      lastName: admin.lastName ?? null,
      avatarUrl: admin.avatarUrl ?? null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  async getByAdminId(adminUserId: string) {
    if (!isUuid(adminUserId)) {
      throw new AppError('Invalid admin user id', 400);
    }
    const row = await this.repo.findOne({ where: { id: adminUserId } });
    if (!row) {
      throw new AppError('Admin user not found', 404);
    }
    return this.serialize(row);
  }

  async patchByAdminId(
    adminUserId: string,
    patch: {
      firstName?: string | null;
      lastName?: string | null;
      avatarUrl?: string | null;
    },
    ip?: string
  ) {
    if (!isUuid(adminUserId)) {
      throw new AppError('Invalid admin user id', 400);
    }
    const row = await this.repo.findOne({ where: { id: adminUserId } });
    if (!row) {
      throw new AppError('Admin user not found', 404);
    }

    if (patch.firstName !== undefined) row.firstName = patch.firstName;
    if (patch.lastName !== undefined) row.lastName = patch.lastName;
    if (patch.avatarUrl !== undefined) row.avatarUrl = patch.avatarUrl;

    const saved = await this.repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.profile.patch',
      targetType: 'admin_user',
      targetId: adminUserId,
      metadata: { keys: Object.keys(patch) },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }
}

export const adminProfileService = new AdminProfileService();
