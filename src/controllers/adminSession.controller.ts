import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSessionService } from '@/services/adminSession.service';
import { SESSION_STATUS } from '@/database/entities/session.entity';

export class AdminSessionController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminSessionService.listSessions({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        search: q.search,
        status: q.status,
        type: q.type,
        mentorId: q.mentorId,
        menteeId: q.menteeId,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  metrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const [outcomes, topMentors, topMentees] = await Promise.all([
        adminSessionService.getOutcomeMetrics({
          mentorId: q.mentorId,
          menteeId: q.menteeId,
        }),
        adminSessionService.getTopNoShowRates({ role: 'mentor', limit: 5 }),
        adminSessionService.getTopNoShowRates({ role: 'mentee', limit: 5 }),
      ]);
      return sendSuccessResponse(res, {
        outcomes,
        topNoShowMentors: topMentors,
        topNoShowMentees: topMentees,
      });
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await adminSessionService.getSessionById(
        req.params.sessionId,
      );
      return sendSuccessResponse(res, detail);
    } catch (e) {
      next(e);
    }
  };

  patchStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminSessionService.updateSessionStatus(
        req.params.sessionId,
        req.body.status as SESSION_STATUS,
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminSessionController = new AdminSessionController();
