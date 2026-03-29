import { validate as isUuid } from 'uuid';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import {
  OrgPlan,
  type OrgPlanType,
} from '@/database/entities/orgPlan.entity';
import { AppError } from '@/common';
import { adminAuditService } from './adminAudit.service';

export class AdminOrgPlanService {
  private serialize(p: OrgPlan) {
    return {
      id: p.id,
      planType: p.planType,
      name: p.name,
      status: p.status,
      totalSeats: p.totalSeats,
      usedSeats: p.usedSeats,
      billingAdminUserId: p.billingAdminUserId ?? null,
      metadata: p.metadata ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  async list(planType: OrgPlanType) {
    const repo = AppDataSource.getRepository(OrgPlan);
    const rows = await repo.find({
      where: { planType, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    return { data: rows.map((p) => this.serialize(p)) };
  }

  async create(
    planType: OrgPlanType,
    input: {
      name: string;
      totalSeats: number;
      usedSeats?: number;
      billingAdminUserId?: string | null;
      metadata?: Record<string, unknown>;
    },
    adminUserId: string,
    ip?: string
  ) {
    if (input.billingAdminUserId) {
      const u = await AppDataSource.getRepository(User).findOne({
        where: { id: input.billingAdminUserId },
      });
      if (!u) {
        throw new AppError('Billing admin user not found', 400);
      }
    }

    const repo = AppDataSource.getRepository(OrgPlan);
    const row = repo.create({
      planType,
      name: input.name,
      status: 'active',
      totalSeats: input.totalSeats,
      usedSeats: input.usedSeats ?? 0,
      billingAdminUserId: input.billingAdminUserId ?? null,
      metadata: input.metadata ?? null,
    });
    const saved = await repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.create',
      targetType: 'org_plan',
      targetId: saved.id,
      metadata: { planType },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async update(
    planType: OrgPlanType,
    planId: string,
    input: {
      name?: string;
      totalSeats?: number;
      usedSeats?: number;
      billingAdminUserId?: string | null;
      metadata?: Record<string, unknown> | null;
      status?: 'active' | 'inactive';
    },
    adminUserId: string,
    ip?: string
  ) {
    if (!isUuid(planId)) {
      throw new AppError('Invalid plan id', 400);
    }

    const repo = AppDataSource.getRepository(OrgPlan);
    const row = await repo.findOne({ where: { id: planId, planType } });
    if (!row) {
      throw new AppError('Plan not found', 404);
    }

    if (input.billingAdminUserId) {
      const u = await AppDataSource.getRepository(User).findOne({
        where: { id: input.billingAdminUserId },
      });
      if (!u) {
        throw new AppError('Billing admin user not found', 400);
      }
    }

    if (input.name !== undefined) {
      row.name = input.name;
    }
    if (input.totalSeats !== undefined) {
      row.totalSeats = input.totalSeats;
    }
    if (input.usedSeats !== undefined) {
      row.usedSeats = input.usedSeats;
    }
    if (input.billingAdminUserId !== undefined) {
      row.billingAdminUserId = input.billingAdminUserId;
    }
    if (input.metadata !== undefined) {
      row.metadata = input.metadata;
    }
    if (input.status !== undefined) {
      row.status = input.status;
    }

    const saved = await repo.save(row);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.org_plan.update',
      targetType: 'org_plan',
      targetId: planId,
      metadata: { planType, patch: Object.keys(input) },
      ip: ip ?? null,
    });

    return this.serialize(saved);
  }

  async deactivate(
    planType: OrgPlanType,
    planId: string,
    adminUserId: string,
    ip?: string
  ) {
    return this.update(
      planType,
      planId,
      { status: 'inactive' },
      adminUserId,
      ip
    );
  }
}

export const adminOrgPlanService = new AdminOrgPlanService();
