import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminReportService } from '@/services/adminReport.service';
import { MenteeReportStatus } from '@/database/entities/menteeReport.entity';

export class AdminReportController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminReportService.listReports({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        status: q.status as MenteeReportStatus | 'all' | undefined,
        assignedTo: q.assignedTo,
        reportedUserId: q.reportedUserId,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  patch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await adminReportService.patchReport(
        req.params.id,
        {
          status: req.body.status,
          assignedTo: req.body.assignedTo,
          resolutionNotes: req.body.resolutionNotes,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, report);
    } catch (e) {
      next(e);
    }
  };
}

export const adminReportController = new AdminReportController();
