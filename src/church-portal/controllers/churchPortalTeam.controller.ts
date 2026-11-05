import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError } from '@/common/errors';
import { CHURCH_PORTAL_USER_ROLE } from '../entities/churchPortalUser.entity';
import { ChurchPortalTeamService } from '../services/churchPortalTeam.service';
import {
  inviteTeamMemberSchema,
  resendTeamInviteSchema,
  updateTeamMemberSchema,
} from '../validation/churchPortalTeam.validation';

/** Runs after churchPortalAuthMiddleware */
export function requirePastor(req: Request, _res: Response, next: NextFunction): void {
  if (req.churchPortalUser?.role !== CHURCH_PORTAL_USER_ROLE.PASTOR) {
    next(new ForbiddenError('Only pastors can manage the church team.'));
    return;
  }
  next();
}

export class ChurchPortalTeamController {
  constructor(private readonly team: ChurchPortalTeamService) {}

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.team.list(req.churchPortalUser!.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  invite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = inviteTeamMemberSchema.parse(req.body);
      const { churchPortalId, id } = req.churchPortalUser!;
      const data = await this.team.invite(churchPortalId, id, body);
      res.status(StatusCodes.CREATED).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  resend = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = resendTeamInviteSchema.parse(req.body ?? {});
      const { churchPortalId, id } = req.churchPortalUser!;
      const data = await this.team.resend(churchPortalId, id, req.params.userId, email);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  cancelInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { churchPortalId, id } = req.churchPortalUser!;
      const data = await this.team.cancelInvite(churchPortalId, id, req.params.userId);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateTeamMemberSchema.parse(req.body);
      const { churchPortalId, id } = req.churchPortalUser!;
      const data = await this.team.update(churchPortalId, id, req.params.userId, body);
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}
