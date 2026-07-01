import { Router } from 'express';
import { validate } from '@/common';
import { authenticateToken } from '@/middleware/auth.middleware';
import { supportController } from '@/controllers/support.controller';
import {
  userSupportTicketCreateSchema,
  userSupportTicketMessageSchema,
} from '@/validation/support.validation';

const router = Router();

router.use(authenticateToken);

router.get('/tickets', supportController.listMyTickets);
router.post(
  '/tickets',
  validate(userSupportTicketCreateSchema, 'body'),
  supportController.createTicket
);
router.get('/tickets/:id', supportController.getTicket);
router.post(
  '/tickets/:id/messages',
  validate(userSupportTicketMessageSchema, 'body'),
  supportController.addMessage
);

export const supportRoutes = router;
