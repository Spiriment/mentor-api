import { Router } from 'express';
import { validate } from '@/common';
import { adminExportController } from '@/controllers/adminExport.controller';
import { adminExportMonthlyBodySchema } from '@/validation/adminPhase5.validation';

const router = Router();

router.post(
  '/monthly-report',
  validate(adminExportMonthlyBodySchema, 'body'),
  adminExportController.monthlyReport
);

export default router;
