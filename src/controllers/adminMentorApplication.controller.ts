import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminMentorApplicationService } from '@/services/adminMentorApplication.service';

export class AdminMentorApplicationController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminMentorApplicationService.listApplications({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        sort: q.sort,
        search: q.search,
        status: q.status as any,
        country: q.country,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detail = await adminMentorApplicationService.getApplicationDetail(
        req.params.id
      );
      return sendSuccessResponse(res, detail);
    } catch (e) {
      next(e);
    }
  };

  appendNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notes = await adminMentorApplicationService.appendNote(
        req.params.id,
        req.admin!.id,
        req.body.body,
        req.ip
      );
      return sendSuccessResponse(res, { internalAdminNotes: notes });
    } catch (e) {
      next(e);
    }
  };

  decision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminMentorApplicationService.applyDecision({
        userId: req.params.id,
        action: req.body.action,
        messageOverride: req.body.messageOverride,
        templateId: req.body.templateId,
        adminUserId: req.admin!.id,
        ip: req.ip,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getTemplatePreview = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const preview = adminMentorApplicationService.getMessageTemplatePreview(
        req.params.templateId
      );
      return sendSuccessResponse(res, preview);
    } catch (e) {
      next(e);
    }
  };
}

export const adminMentorApplicationController =
  new AdminMentorApplicationController();
