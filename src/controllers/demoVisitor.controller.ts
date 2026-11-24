import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { demoVisitorService } from '@/services/demoVisitor.service';
import { demoVisitorActivitySchema, demoVisitorSignupSchema } from '@/validation/demoVisitor.validation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DemoVisitorController {
  /** Public: POST /api/demo-visitors */
  signup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = demoVisitorSignupSchema.parse(req.body);
      return sendSuccessResponse(res, await demoVisitorService.signup(body), 201);
    } catch (e) {
      next(e);
    }
  };

  /** Public: POST /api/demo-visitors/:id/activity */
  activity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (UUID.test(req.params.id)) {
        await demoVisitorService.activity(req.params.id, demoVisitorActivitySchema.parse(req.body ?? {}));
      }
      return sendSuccessResponse(res, { ok: true });
    } catch (e) {
      next(e);
    }
  };

  /** Admin: GET /api/admin/demo-visitors */
  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await demoVisitorService.list());
    } catch (e) {
      next(e);
    }
  };

  /** Admin: DELETE /api/admin/demo-visitors/:id */
  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      return sendSuccessResponse(res, await demoVisitorService.remove(req.params.id));
    } catch (e) {
      next(e);
    }
  };
}

export const demoVisitorController = new DemoVisitorController();
