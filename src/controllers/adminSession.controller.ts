import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSessionService } from '@/services/adminSession.service';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { AppDataSource } from '@/config/data-source';
import { StreamService } from '@/core/stream.service';

const callHealthStream = new StreamService();

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

  /** Stream call stats for this session — diagnose "no video", dropped calls, poor quality. */
  callHealth = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await AppDataSource.getRepository(Session).findOne({
        where: { id: req.params.sessionId },
        select: ['id', 'mentorId', 'menteeId'],
      });
      if (!session) {
        return res.status(404).json({ success: false, error: { message: 'Session not found' } });
      }
      // Same id the app joins with (generateStreamCallId in mentor-app/src/utils/callUtils.ts)
      const callId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const calls = await callHealthStream.getCallHealth(callId, {
        mentorId: session.mentorId,
        menteeId: session.menteeId,
      });
      return sendSuccessResponse(res, { callId, calls });
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
