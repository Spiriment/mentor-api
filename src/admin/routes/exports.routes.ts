import { Router } from 'express';
import { validate } from '@/common';
import { adminExportController } from '@/controllers/adminExport.controller';
import {
  adminExportMonthlyBodySchema,
  adminExportReportTypeSchema,
} from '@/validation/adminPhase5.validation';

const router = Router();

router.get(
  '/:reportType',
  (req, res, next) => {
    const parsed = adminExportReportTypeSchema.safeParse(req.params.reportType);
    if (!parsed.success) {
      return res.status(404).json({
        success: false,
        error: { message: 'Unknown export report type' },
      });
    }
    next();
  },
  adminExportController.downloadReport
);

router.post(
  '/monthly-report',
  validate(adminExportMonthlyBodySchema, 'body'),
  adminExportController.monthlyReport
);

export default router;
