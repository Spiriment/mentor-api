import { Request, Response, NextFunction } from 'express';
import { adminExportService } from '@/services/adminExport.service';
import { adminAuditService } from '@/services/adminAudit.service';

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
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', csv.byteLength);
      return res.end(csv);
    } catch (e) {
      next(e);
    }
  };
}

export const adminExportController = new AdminExportController();
