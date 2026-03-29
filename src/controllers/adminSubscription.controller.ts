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
}

export const adminSubscriptionController = new AdminSubscriptionController();
