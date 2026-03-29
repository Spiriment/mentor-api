import { AppDataSource } from '@/config/data-source';
import { SpirimentSettings } from '@/database/entities/spirimentSettings.entity';
import { AppError } from '@/common';
import { adminAuditService } from './adminAudit.service';

const GLOBAL_ID = 'global';

export class AdminSpirimentSettingsService {
  async getGlobal() {
    const repo = AppDataSource.getRepository(SpirimentSettings);
    let row = await repo.findOne({ where: { id: GLOBAL_ID } });
    if (!row) {
      row = repo.create({
        id: GLOBAL_ID,
        data: {
          supportEmail: 'support@spiriment.com',
          publicAppName: 'Spiriment',
          maintenanceMode: false,
          features: {
            mentorApplications: true,
            groupSessions: true,
          },
        },
      });
      await repo.save(row);
    }
    return { id: row.id, data: row.data, updatedAt: row.updatedAt };
  }

  async patch(
    patch: {
      supportEmail?: string;
      publicAppName?: string;
      maintenanceMode?: boolean;
      features?: Record<string, boolean>;
    },
    adminUserId: string,
    ip?: string
  ) {
    const repo = AppDataSource.getRepository(SpirimentSettings);
    let row = await repo.findOne({ where: { id: GLOBAL_ID } });
    if (!row) {
      await this.getGlobal();
      row = await repo.findOne({ where: { id: GLOBAL_ID } });
    }
    if (!row) {
      throw new AppError('Spiriment settings not available', 500);
    }

    const data = { ...row.data };
    if (patch.supportEmail !== undefined) {
      data.supportEmail = patch.supportEmail;
    }
    if (patch.publicAppName !== undefined) {
      data.publicAppName = patch.publicAppName;
    }
    if (patch.maintenanceMode !== undefined) {
      data.maintenanceMode = patch.maintenanceMode;
    }
    if (patch.features !== undefined) {
      const prev =
        data.features &&
        typeof data.features === 'object' &&
        !Array.isArray(data.features)
          ? (data.features as Record<string, boolean>)
          : {};
      data.features = { ...prev, ...patch.features };
    }

    row.data = data;
    await repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.settings.patch',
      targetType: 'spiriment_settings',
      targetId: GLOBAL_ID,
      metadata: { keys: Object.keys(patch) },
      ip: ip ?? null,
    });

    return { id: row.id, data: row.data, updatedAt: row.updatedAt };
  }
}

export const adminSpirimentSettingsService = new AdminSpirimentSettingsService();
