import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError } from '@/common/errors';
import { sendSuccessResponse } from '@/common/helpers';
import { churchBillingService } from '@/services/churchBilling.service';
import type { BillingActor } from '@/services/adminOrgPlan.service';
import { CHURCH_PORTAL_USER_ROLE } from '@/church-portal/entities/churchPortalUser.entity';
import {
  churchPortalHistory,
  type ChurchHistoryAction,
  type ChurchHistoryActor,
} from '@/church-portal/services/churchPortalHistory.service';
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
  /** Who the church's history names for this change */
  historyActor: (req: Request) => ChurchHistoryActor;
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

  const recordMemberChange = async (req: Request, action: ChurchHistoryAction, detail?: string) => {
    await churchPortalHistory.record({
      churchPortalId: scope.portalId(req),
      actor: scope.historyActor(req),
      action,
      targetName: await churchPortalHistory.memberName(req.params.userId).catch(() => null),
      detail,
    });
  };

  return {
    overview: wrap(async (req, res) => {
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)));
    }),
    cover: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      const { tier } = churchCoverageTierSchema.parse(req.body);
      await churchBillingService.cover(scope.portalId(req), req.params.userId, tier, scope.actor(req), req.ip);
      await recordMemberChange(req, 'billing.member_covered', tier);
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)), StatusCodes.CREATED);
    }),
    changeTier: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      const { tier } = churchCoverageTierSchema.parse(req.body);
      await churchBillingService.changeTier(scope.portalId(req), req.params.userId, tier, scope.actor(req), req.ip);
      await recordMemberChange(req, 'billing.member_tier_changed', tier);
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)));
    }),
    uncover: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      await churchBillingService.uncover(scope.portalId(req), req.params.userId, scope.actor(req));
      await recordMemberChange(req, 'billing.member_uncovered');
      scope.respond(res, await churchBillingService.getOverview(scope.portalId(req)));
    }),
    updateSettings: wrap(async (req, res) => {
      scope.assertCanEdit(req);
      const body = scope.settingsSchema.parse(req.body);
      const updated = await churchBillingService.updateSettings(scope.portalId(req), body, scope.actor(req));
      await churchPortalHistory.record({
        churchPortalId: scope.portalId(req),
        actor: scope.historyActor(req),
        action: 'billing.settings_changed',
      });
      scope.respond(res, updated);
    }),
  };
}

/** Church portal: only the `pastor` role changes billing; deacons and leaders can view */
export const churchPortalBillingHandlers = buildHandlers({
  portalId: (req) => req.churchPortalUser!.churchPortalId,
  actor: (req) => ({ kind: 'church_portal', id: req.churchPortalUser!.id }),
  historyActor: (req) => ({ portalUserId: req.churchPortalUser!.id }),
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
  historyActor: () => ({ label: 'Spiriment support' }),
  assertCanEdit: () => undefined,
  settingsSchema: churchBillingSettingsAdminSchema,
  respond: (res, data, status = StatusCodes.OK) => {
    sendSuccessResponse(res, data, status);
  },
});
