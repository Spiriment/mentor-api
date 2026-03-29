import { AppDataSource } from '@/config/data-source';
import { AdminAuditLog } from '@/database/entities/adminAuditLog.entity';

export type AdminAuditInput = {
  adminUserId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
};

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
}

export const adminAuditService = new AdminAuditService();
