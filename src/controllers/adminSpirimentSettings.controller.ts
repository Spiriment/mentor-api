import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminSpirimentSettingsService } from '@/services/adminSpirimentSettings.service';
import { appReleaseService } from '@/services/appRelease.service';

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
          // Was missing: the admin portal's template edits reported "saved" but were dropped
          emailTemplates: req.body.emailTemplates,
          appRelease: req.body.appRelease,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, row);
    } catch (e) {
      next(e);
    }
  };
  /** Preview (dryRun) or send "update available" pushes to users on older app versions. */
  notifyAppUpdate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await appReleaseService.notifyUpdate({
        platforms: req.body.platforms,
        // validate() doesn't write parsed defaults back to req.body, so enforce it here:
        // only an explicit dryRun: false sends — a broadcast push can't be recalled.
        dryRun: req.body.dryRun !== false,
        adminUserId: req.admin!.id,
        ip: req.ip,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminSpirimentSettingsController =
  new AdminSpirimentSettingsController();
