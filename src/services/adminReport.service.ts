import { AppDataSource } from '@/config/data-source';
import { MenteeReport, MenteeReportStatus } from '@/database/entities/menteeReport.entity';
import { AppError } from '@/common';
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

    const [data, total] = await qb.getManyAndCount();

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
