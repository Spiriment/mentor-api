import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChurchPortalDashboardService } from '../services/churchPortalDashboard.service';

export class ChurchPortalDashboardController {
  constructor(private readonly dashboardService: ChurchPortalDashboardService) {}

  getSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.dashboardService.getSummary(req.churchPortalUser!.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getActivityFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.dashboardService.getActivityFeed(req.churchPortalUser!.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}
