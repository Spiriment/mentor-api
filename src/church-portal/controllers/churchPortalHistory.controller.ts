import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { churchPortalHistory } from '../services/churchPortalHistory.service';

const exportSchema = z.object({
  list: z.enum(['Mentors', 'Mentees', 'Sessions', 'Bible reading', 'Quizzes']),
});

export class ChurchPortalHistoryController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as Record<string, string>;
      const result = await churchPortalHistory.list(
        req.churchPortalUser!.churchPortalId,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 20,
      );
      res.status(StatusCodes.OK).json({ status: 'success', ...result });
    } catch (err) {
      next(err);
    }
  };

  /** Exports are built in the browser from the normal lists, so the Export button reports them */
  recordExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { list } = exportSchema.parse(req.body);
      await churchPortalHistory.record({
        churchPortalId: req.churchPortalUser!.churchPortalId,
        actor: { portalUserId: req.churchPortalUser!.id },
        action: 'export.downloaded',
        detail: list,
      });
      res.status(StatusCodes.CREATED).json({ status: 'success', data: { recorded: true } });
    } catch (err) {
      next(err);
    }
  };
}
