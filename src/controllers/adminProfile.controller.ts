import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminProfileService } from '@/services/adminProfile.service';

export class AdminProfileController {
  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await adminProfileService.getByAdminId(req.admin!.id);
      return sendSuccessResponse(res, profile);
    } catch (e) {
      next(e);
    }
  };

  patchMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminProfileService.patchByAdminId(
        req.admin!.id,
        {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          avatarUrl: req.body.avatarUrl,
        },
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };
}

export const adminProfileController = new AdminProfileController();
