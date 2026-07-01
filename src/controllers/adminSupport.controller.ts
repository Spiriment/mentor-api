import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSupportService } from '@/services/adminSupport.service';

function adminDisplayName(req: Request): string {
  const admin = req.admin!;
  const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
  return name || admin.email || 'Support Team';
}

export class AdminSupportController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminSupportService.listTickets({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        search: q.search,
        status: q.status as any,
        priority: q.priority as any,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await adminSupportService.getTicketById(req.params.id);
      return sendSuccessResponse(res, ticket);
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await adminSupportService.updateTicket(req.params.id, req.body);
      return sendSuccessResponse(res, ticket);
    } catch (e) {
      next(e);
    }
  };

  addMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await adminSupportService.addMessage(
        req.params.id,
        req.admin!.id,
        adminDisplayName(req),
        req.body
      );
      return sendSuccessResponse(res, ticket);
    } catch (e) {
      next(e);
    }
  };
}

export const adminSupportController = new AdminSupportController();
