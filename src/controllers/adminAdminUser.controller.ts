import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminAdminUserService } from '@/services/adminAdminUser.service';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';

export class AdminAdminUserController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminAdminUserService.list({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        sort: q.sort,
        search: q.search,
        role: q.role as ADMIN_ROLE | undefined,
        isActive:
          q.isActive === undefined ? undefined : q.isActive === 'true',
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  post = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await adminAdminUserService.create(
        {
          email: req.body.email,
          password: req.body.password,
          role: req.body.role,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, created, 201);
    } catch (e) {
      next(e);
    }
  };

  patchStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminAdminUserService.setActive(
        req.params.adminUserId,
        req.body.isActive,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminAdminUserService.resetPassword(
        req.params.adminUserId,
        req.body.password,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminAdminUserController = new AdminAdminUserController();
