import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminReceiptService } from '@/services/adminReceipt.service';
import { AdminReceiptStatus } from '@/database/entities/adminReceipt.entity';
import { adminReceiptCreateBodySchema } from '@/validation/adminReceipt.validation';

export class AdminReceiptController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminReceiptService.list({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        status: q.status as AdminReceiptStatus | undefined,
        search: q.search,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await adminReceiptService.get(req.params.id));
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // validate() only checks the body; parse here so amounts arrive as numbers, trimmed
      const body = adminReceiptCreateBodySchema.parse(req.body);
      return sendSuccessResponse(res, await adminReceiptService.createStandalone(body, req.admin!.id), 201);
    } catch (e) {
      next(e);
    }
  };

  void = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await adminReceiptService.void(req.params.id, req.admin!.id));
    } catch (e) {
      next(e);
    }
  };
}

export const adminReceiptController = new AdminReceiptController();
