import { AppDataSource } from '@/config/data-source';
import { MenteeReport, MenteeReportStatus } from '@/database/entities/menteeReport.entity';
import { AppError } from '@/common';
import { In } from 'typeorm';
import { User } from '@/database/entities/user.entity';
import { isReportReason, REPORT_REASONS } from '@/common/safety';
import { adminAuditService } from './adminAudit.service';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

export class AdminReportService {
  private repo = AppDataSource.getRepository(MenteeReport);

  async listReports(params: {
    page?: number;
    limit?: number;
    status?: MenteeReportStatus | 'all';
    assignedTo?: string;
    reportedUserId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const statusFilter = params.status ?? 'open';
    if (statusFilter !== 'all') {
      qb.andWhere('r.status = :status', { status: statusFilter });
    }

    if (params.assignedTo) {
      qb.andWhere('r.assignedTo = :assignedTo', { assignedTo: params.assignedTo });
    }

    if (params.reportedUserId) {
      qb.andWhere('r.reportedUserId = :reportedUserId', { reportedUserId: params.reportedUserId });
    }

    if (params.dateFrom) {
      qb.andWhere('r.createdAt >= :dateFrom', { dateFrom: new Date(params.dateFrom) });
    }

    if (params.dateTo) {
      qb.andWhere('r.createdAt <= :dateTo', { dateTo: new Date(params.dateTo) });
    }

    const [reports, total] = await qb.getManyAndCount();

    // Names for both sides, looked up by id (no SQL join: see the user_blocks migration on
    // production collations), plus how often each reported person has been reported
    const ids = [...new Set(reports.flatMap((r) => [r.reporterId, r.reportedUserId]))];
    const users = ids.length
      ? await AppDataSource.getRepository(User).find({
          where: { id: In(ids) },
          select: ['id', 'firstName', 'lastName', 'email', 'role', 'accountStatus', 'isActive'],
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const reportedIds = [...new Set(reports.map((r) => r.reportedUserId))];
    const counts = reportedIds.length
      ? await this.repo
          .createQueryBuilder('r')
          .select('r.reportedUserId', 'id')
          .addSelect('COUNT(*)', 'n')
          .where('r.reportedUserId IN (:...reportedIds)', { reportedIds })
          .groupBy('r.reportedUserId')
          .getRawMany<{ id: string; n: string }>()
      : [];
    const reportCount = new Map(counts.map((c) => [c.id, Number(c.n)]));

    const data = reports.map((r) => ({
      ...r,
      reasonLabel: isReportReason(r.reason) ? REPORT_REASONS[r.reason] : r.reason,
      reporter: byId.get(r.reporterId) ?? null,
      reportedUser: byId.get(r.reportedUserId) ?? null,
      reportsAgainstUser: reportCount.get(r.reportedUserId) ?? 1,
    }));

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

  async patchReport(
    id: string,
    patch: {
      status?: MenteeReportStatus;
      assignedTo?: string | null;
      resolutionNotes?: string | null;
    },
    adminUserId: string,
    ip?: string
  ) {
    const report = await this.repo.findOne({ where: { id } });
    if (!report) throw new AppError('Report not found', 404);

    if (patch.status !== undefined) report.status = patch.status;
    if (patch.assignedTo !== undefined) report.assignedTo = patch.assignedTo ?? undefined;
    if (patch.resolutionNotes !== undefined) report.resolutionNotes = patch.resolutionNotes ?? undefined;

    await this.repo.save(report);

    await adminAuditService.log({
      adminUserId,
      action: 'admin.report.patch',
      targetType: 'mentee_report',
      targetId: id,
      metadata: patch,
      ip,
    });

    return report;
  }
}

export const adminReportService = new AdminReportService();
