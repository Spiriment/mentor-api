import { Router } from 'express';
import { validate } from '@/common';
import { adminSupportController } from '@/controllers/adminSupport.controller';
import {
  supportTicketListQuerySchema,
  supportTicketMessageBodySchema,
  supportTicketUpdateBodySchema,
} from '@/validation/adminSupport.validation';

const router = Router();

router.get(
  '/tickets',
  validate(supportTicketListQuerySchema, 'query'),
  adminSupportController.list
);
router.get('/tickets/:id', adminSupportController.getById);
router.patch(
  '/tickets/:id',
  validate(supportTicketUpdateBodySchema, 'body'),
  adminSupportController.update
);
router.post(
  '/tickets/:id/messages',
  validate(supportTicketMessageBodySchema, 'body'),
  adminSupportController.addMessage
);

export default router;
