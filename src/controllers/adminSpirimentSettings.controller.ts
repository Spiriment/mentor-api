import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSpirimentSettingsService } from '@/services/adminSpirimentSettings.service';

export class AdminSpirimentSettingsController {
  get = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await adminSpirimentSettingsService.getGlobal();
      return sendSuccessResponse(res, row);
    } catch (e) {
      next(e);
    }
  };

  patch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = await adminSpirimentSettingsService.patch(
        {
          supportEmail: req.body.supportEmail,
          publicAppName: req.body.publicAppName,
          maintenanceMode: req.body.maintenanceMode,
          features: req.body.features,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, row);
    } catch (e) {
      next(e);
    }
  };
}

export const adminSpirimentSettingsController =
  new AdminSpirimentSettingsController();
