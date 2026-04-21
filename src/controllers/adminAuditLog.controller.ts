import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminAuditService } from '@/services/adminAudit.service';

export class AdminAuditLogController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminAuditService.listLogs({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        adminUserId: q.adminUserId,
        action: q.action,
        targetType: q.targetType,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminAuditLogController = new AdminAuditLogController();
