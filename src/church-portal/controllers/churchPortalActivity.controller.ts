import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChurchPortalActivityService } from '../services/churchPortalActivity.service';

export class ChurchPortalActivityController {
  constructor(private readonly activityService: ChurchPortalActivityService) {}

  getMentors = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.activityService.getMentors(req.churchPortalUser!.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getMentees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.activityService.getMentees(req.churchPortalUser!.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, filter } = req.query as Record<string, string>;
      const allowed = new Set(['all', 'past', 'upcoming', 'canceled']);
      const timeFilter = filter && allowed.has(filter) ? (filter as 'all' | 'past' | 'upcoming' | 'canceled') : 'all';
      const data = await this.activityService.getSessions(
        req.churchPortalUser!.churchPortalId,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20,
        timeFilter
      );
      res.status(StatusCodes.OK).json({ status: 'success', ...data });
    } catch (err) {
      next(err);
    }
  };

  getBibleReading = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as Record<string, string>;
      const data = await this.activityService.getBibleReading(
        req.churchPortalUser!.churchPortalId,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 10
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}
