import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminInvoiceService } from '@/services/adminInvoice.service';
import { AdminInvoiceStatus } from '@/database/entities/adminInvoice.entity';
import { adminInvoiceCreateBodySchema } from '@/validation/adminInvoice.validation';

// The shared validate() middleware only checks the body; parse here so amounts and VAT arrive
// as numbers and fields are trimmed exactly as validated
const parseInvoiceBody = (body: unknown) => adminInvoiceCreateBodySchema.parse(body);

export class AdminInvoiceController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminInvoiceService.list({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        status: q.status as AdminInvoiceStatus | undefined,
        search: q.search,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await adminInvoiceService.get(req.params.id));
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await adminInvoiceService.create(parseInvoiceBody(req.body), req.admin!.id);
      return sendSuccessResponse(res, invoice, 201);
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(
        res,
        await adminInvoiceService.update(req.params.id, parseInvoiceBody(req.body), req.admin!.id)
      );
    } catch (e) {
      next(e);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await adminInvoiceService.remove(req.params.id, req.admin!.id));
    } catch (e) {
      next(e);
    }
  };

  issue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await adminInvoiceService.issue(req.params.id, req.admin!.id));
    } catch (e) {
      next(e);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(
        res,
        await adminInvoiceService.setStatus(req.params.id, AdminInvoiceStatus.PAID, req.admin!.id)
      );
    } catch (e) {
      next(e);
    }
  };

  markUnpaid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(
        res,
        await adminInvoiceService.setStatus(req.params.id, AdminInvoiceStatus.ISSUED, req.admin!.id)
      );
    } catch (e) {
      next(e);
    }
  };

  void = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(
        res,
        await adminInvoiceService.setStatus(req.params.id, AdminInvoiceStatus.VOID, req.admin!.id)
      );
    } catch (e) {
      next(e);
    }
  };

  duplicate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(
        res,
        await adminInvoiceService.duplicate(req.params.id, req.admin!.id),
        201
      );
    } catch (e) {
      next(e);
    }
  };
}

export const adminInvoiceController = new AdminInvoiceController();
