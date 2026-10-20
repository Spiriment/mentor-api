import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError } from '@/common/errors';
import { sendSuccessResponse } from '@/common/helpers';
import { churchBillingService } from '@/services/churchBilling.service';
import type { BillingActor } from '@/services/adminOrgPlan.service';
import { CHURCH_PORTAL_USER_ROLE } from '@/church-portal/entities/churchPortalUser.entity';
import {
  churchBillingSettingsAdminSchema,
  churchBillingSettingsPastorSchema,
  churchCoverageTierSchema,
} from '@/validation/churchBilling.validation';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Who the church pays for, reached two ways: by pastors (church portal, scoped to their own
 * church by their token) and by Spiriment admins (admin panel, church from the URL).
 */
function buildHandlers(scope: {
  portalId: (req: Request) => string;
  actor: (req: Request) => BillingActor;
  /** Throws when this caller may only view */
  assertCanEdit: (req: Request) => void;
  settingsSchema: typeof churchBillingSettingsAdminSchema | typeof churchBillingSettingsPastorSchema;
  respond: (res: Response, data: unknown, status?: number) => void;
}) {
  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>): Handler =>
    async (req, res, next) => {
      try {
        await fn(req, res);
      } catch (err) {
        next(err);
      }
    };

  return {
    overview: wrap(async (req, res) => {
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)));
    }),
    cover: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      const { tier } = churchCoverageTierSchema.parse(req.body);
      await churchBillingService.cover(scope.portalId(req), req.params.userId, tier, scope.actor(req), req.ip);
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)), StatusCodes.CREATED);
    }),
    changeTier: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      const { tier } = churchCoverageTierSchema.parse(req.body);
      await churchBillingService.changeTier(scope.portalId(req), req.params.userId, tier, scope.actor(req), req.ip);
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)));
    }),
    uncover: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      await churchBillingService.uncover(scope.portalId(req), req.params.userId, scope.actor(req));
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)));
    }),
    updateSettings: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      const body = scope.settingsSchema.parse(req.body);
      scope.respond(res, await churchBillingService.updateSettings(scope.portalId(req), body, scope.actor(req)));
    }),
  };
}

/** Church portal: only the `pastor` role changes billing; deacons and leaders can view */
export const churchPortalBillingHandlers = buildHandlers({
  portalId: (req) => req.churchPortalUser!.churchPortalId,
  actor: (req) => ({ kind: 'church_portal', id: req.churchPortalUser!.id }),
  assertCanEdit: (req) => {
    if (req.churchPortalUser?.role !== CHURCH_PORTAL_USER_ROLE.PASTOR) {
      throw new ForbiddenError('Only pastors can change who the church pays for.');
    }
  },
  settingsSchema: churchBillingSettingsPastorSchema,
  // Church portal responses use { status, data } (see cp-client)
  respond: (res, data, status = StatusCodes.OK) => {
    res.status(status).json({ status: 'success', data });
  },
});

/** Admin panel (routes are super-admin only) */
export const adminChurchBillingHandlers = buildHandlers({
  portalId: (req) => req.params.portalId,
  actor: (req) => ({ kind: 'admin', id: req.admin!.id }),
  assertCanEdit: () => undefined,
  settingsSchema: churchBillingSettingsAdminSchema,
  respond: (res, data, status = StatusCodes.OK) => {
    sendSuccessResponse(res, data, status);
  },
});
