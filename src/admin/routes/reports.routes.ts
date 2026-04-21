import { Router } from 'express';
import { validate } from '@/common';
import { adminReportController } from '@/controllers/adminReport.controller';
import { adminReportListQuerySchema, adminReportPatchBodySchema } from '@/validation/adminPhase5.validation';

const router = Router();

router.get(
  '/',
  validate(adminReportListQuerySchema, 'query'),
  adminReportController.list
);

router.patch(
  '/:id',
  validate(adminReportPatchBodySchema, 'body'),
  adminReportController.patch
);

export default router;
