import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import { adminExportController } from '@/controllers/adminExport.controller';
import {
  adminExportMonthlyBodySchema,
  adminExportReportTypeSchema,
} from '@/validation/adminPhase5.validation';

const router = Router();

// Exports contain every user's email (users, mentors, mentees, subscriptions, sessions) —
// super admin only, matching "Export Reports" in the portal's permissions matrix.
router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

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
