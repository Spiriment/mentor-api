import { Request, Response, NextFunction } from 'express';
import { adminAlertService } from '@/services/adminAlert.service';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSupportService } from '@/services/adminSupport.service';
import { AppError } from '@/common';

export class SupportController {
  listMyTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await adminSupportService.listUserTickets(userId, page, limit);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  createTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const ticket = await adminSupportService.createTicketForUser(userId, req.body);
      void adminAlertService.notify('support_ticket', {
        title: 'New support ticket',
        body: (ticket as any)?.subject || 'A user opened a support ticket.',
        link: '/support',
      });
      return sendSuccessResponse(res, ticket, 201);
    } catch (e) {
      next(e);
    }
  };

  getTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const ticket = await adminSupportService.getTicketForUser(userId, req.params.id);
      return sendSuccessResponse(res, ticket);
    } catch (e) {
      next(e);
    }
  };

  addMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw new AppError('Unauthorized', 401);

      const ticket = await adminSupportService.addUserMessage(
        userId,
        req.params.id,
        req.body.text
      );
      void adminAlertService.notify('support_ticket', {
        title: 'New reply on a support ticket',
        body: (ticket as any)?.subject || 'A user replied on a support ticket.',
        link: '/support',
      });
      return sendSuccessResponse(res, ticket);
    } catch (e) {
      next(e);
    }
  };
}

export const supportController = new SupportController();
