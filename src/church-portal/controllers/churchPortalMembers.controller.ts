import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChurchPortalMembersService } from '../services/churchPortalMembers.service';

export class ChurchPortalMembersController {
  constructor(private readonly membersService: ChurchPortalMembersService) {}

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, page, limit } = req.query as Record<string, string>;
      const data = await this.membersService.listMembers(
        req.churchPortalUser!.churchPortalId,
        role as 'mentor' | 'mentee' | undefined,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );
      res.status(StatusCodes.OK).json({ status: 'success', ...data });
    } catch (err) {
      next(err);
    }
  };

  getMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.membersService.getMember(
        req.churchPortalUser!.churchPortalId,
        req.params.userId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  getMemberSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = req.query as Record<string, string>;
      const data = await this.membersService.getMemberSessions(
        req.churchPortalUser!.churchPortalId,
        req.params.userId,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );
      res.status(StatusCodes.OK).json({ status: 'success', ...data });
    } catch (err) {
      next(err);
    }
  };

  getMemberStreak = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.membersService.getMemberStreak(
        req.churchPortalUser!.churchPortalId,
        req.params.userId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}
