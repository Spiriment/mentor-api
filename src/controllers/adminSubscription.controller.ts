import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSubscriptionService } from '@/services/adminSubscription.service';

export class AdminSubscriptionController {
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await adminSubscriptionService.getSummary(
        req.admin!.role
      );
      return sendSuccessResponse(res, summary);
    } catch (e) {
      next(e);
    }
  };

  listIndividual = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await adminSubscriptionService.listIndividualSubscribers(
        page,
        limit
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminSubscriptionController = new AdminSubscriptionController();
