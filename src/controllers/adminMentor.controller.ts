import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminMentorService } from '@/services/adminMentor.service';

export class AdminMentorController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const approvedOnlyRaw = q.approvedOnly;
      const approvedOnly =
        approvedOnlyRaw === undefined || approvedOnlyRaw === ''
          ? true
          : approvedOnlyRaw !== 'false' && approvedOnlyRaw !== '0';

      const result = await adminMentorService.listMentors({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        sort: q.sort,
        search: q.search,
        country: q.country,
        accountStatus: q.accountStatus as any,
        approvedOnly,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await adminMentorService.getMentorDetail(req.params.userId);
      return sendSuccessResponse(res, detail);
    } catch (e) {
      next(e);
    }
  };

  patchStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminMentorService.updateMentorStatus(
        req.params.userId,
        req.body.action,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  postMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminMentorService.sendMentorAdminMessage(
        req.params.userId,
        {
          title: req.body.title,
          message: req.body.message,
          channels: req.body.channels ?? ['in_app', 'email'],
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  listReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminMentorService.listMentorReviews(req.params.userId, {
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  deleteReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
      const result = await adminMentorService.deleteMentorReview(
        req.params.userId,
        req.params.reviewId,
        req.admin!.id,
        reason,
        req.ip
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminMentorController = new AdminMentorController();
