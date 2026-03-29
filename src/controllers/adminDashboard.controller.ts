import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminDashboardService } from '@/services/adminDashboard.service';

export class AdminDashboardController {
  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await adminDashboardService.getSummary(req.admin!.role);
      return sendSuccessResponse(res, summary);
    } catch (e) {
      next(e);
    }
  };
}

export const adminDashboardController = new AdminDashboardController();
