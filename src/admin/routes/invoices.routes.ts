import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import { adminInvoiceController } from '@/controllers/adminInvoice.controller';
import {
  adminInvoiceCreateBodySchema,
  adminInvoiceListQuerySchema,
  adminInvoiceUpdateBodySchema,
} from '@/validation/adminInvoice.validation';
import { adminReceiptPaymentBodySchema } from '@/validation/adminReceipt.validation';

/** General invoices — super admin only. Base path: /api/admin/invoices */
const router = Router();

router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

router.get('/', validate(adminInvoiceListQuerySchema, 'query'), adminInvoiceController.list);
router.post('/', validate(adminInvoiceCreateBodySchema, 'body'), adminInvoiceController.create);
router.get('/:id', adminInvoiceController.get);
router.put('/:id', validate(adminInvoiceUpdateBodySchema, 'body'), adminInvoiceController.update);
router.delete('/:id', adminInvoiceController.remove);
router.post('/:id/issue', adminInvoiceController.issue);
router.post('/:id/mark-paid', validate(adminReceiptPaymentBodySchema, 'body'), adminInvoiceController.markPaid);
router.post('/:id/receipt', validate(adminReceiptPaymentBodySchema, 'body'), adminInvoiceController.createReceipt);
router.post('/:id/mark-unpaid', adminInvoiceController.markUnpaid);
router.post('/:id/void', adminInvoiceController.void);
router.post('/:id/duplicate', adminInvoiceController.duplicate);

export default router;
