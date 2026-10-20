import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChurchPortalMembersService } from '../services/churchPortalMembers.service';
import { churchPortalJoinRequestService } from '../services/churchPortalJoinRequest.service';
import { CHURCH_PORTAL_USER_ROLE } from '../entities/churchPortalUser.entity';
import { ForbiddenError } from '@/common/errors';

export class ChurchPortalMembersController {
  constructor(private readonly membersService: ChurchPortalMembersService) {}

  listJoinRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await churchPortalJoinRequestService.listPendingForPortal(
        req.churchPortalUser!.churchPortalId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  approveJoinRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await churchPortalJoinRequestService.approve(
        req.churchPortalUser!.churchPortalId,
        req.params.userId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  rejectJoinRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await churchPortalJoinRequestService.reject(
        req.churchPortalUser!.churchPortalId,
        req.params.userId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

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

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // It also ends anything the church pays for, so it's a billing change: pastors only
      if (req.churchPortalUser!.role !== CHURCH_PORTAL_USER_ROLE.PASTOR) {
        throw new ForbiddenError('Only pastors can remove members from the church.');
      }
      const data = await this.membersService.removeMember(
        req.churchPortalUser!.churchPortalId,
        req.params.userId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
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
