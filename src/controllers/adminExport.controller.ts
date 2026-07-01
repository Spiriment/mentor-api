import { Request, Response, NextFunction } from 'express';
import { adminExportService, AdminExportReportType } from '@/services/adminExport.service';
import { adminAuditService } from '@/services/adminAudit.service';

function sendCsv(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.byteLength);
  return res.end(buffer);
}

export class AdminExportController {
  monthlyReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { year, month, timezone } = req.body as {
        year: number;
        month: number;
        timezone: string;
      };

      const csv = await adminExportService.buildMonthlyReport(year, month, timezone);

      await adminAuditService.log({
        adminUserId: req.admin!.id,
        action: 'admin.export.monthly_report',
        metadata: { year, month, timezone },
        ip: req.ip,
      });

      const filename = `spiriment-report-${year}-${String(month).padStart(2, '0')}.csv`;
      return sendCsv(res, csv, filename);
    } catch (e) {
      next(e);
    }
  };

  downloadReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reportType = req.params.reportType as AdminExportReportType;
      const { buffer, filename } = await adminExportService.buildReport(
        reportType,
        req.admin!.role
      );

      await adminAuditService.log({
        adminUserId: req.admin!.id,
        action: 'admin.export.report',
        metadata: { reportType },
        ip: req.ip,
      });

      return sendCsv(res, buffer, filename);
    } catch (e) {
      next(e);
    }
  };
}

export const adminExportController = new AdminExportController();
