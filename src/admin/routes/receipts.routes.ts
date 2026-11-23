import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import { adminReceiptController } from '@/controllers/adminReceipt.controller';
import {
  adminReceiptCreateBodySchema,
  adminReceiptListQuerySchema,
} from '@/validation/adminReceipt.validation';

/**
 * Payment receipts — super admin only. Base path: /api/admin/receipts
 * Receipts for invoices are created via POST /invoices/:id/mark-paid or /invoices/:id/receipt.
 */
const router = Router();

router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

router.get('/', validate(adminReceiptListQuerySchema, 'query'), adminReceiptController.list);
router.post('/', validate(adminReceiptCreateBodySchema, 'body'), adminReceiptController.create);
router.get('/:id', adminReceiptController.get);
router.post('/:id/void', adminReceiptController.void);

export default router;
