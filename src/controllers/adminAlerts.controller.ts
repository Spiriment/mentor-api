import { Request, Response, NextFunction } from 'express';
import { IsNull } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { sendSuccessResponse } from '@/common/helpers';
import { AdminUser } from '@/database/entities/adminUser.entity';
import { AdminAlert } from '@/database/entities/adminAlert.entity';
import { AdminPushSubscription } from '@/database/entities/adminPushSubscription.entity';
import {
  ADMIN_ALERT_EVENTS,
  BELL_UNSUPPORTED,
  EVENT_ROLES,
  resolvePreferences,
} from '@/common/adminAlerts';
import { adminAlertService } from '@/services/adminAlert.service';

/** Per-admin notification preferences, browser push registration, and bell alerts. */
export const adminAlertsController = {
  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = await AppDataSource.getRepository(AdminUser).findOneByOrFail({ id: req.admin!.id });
      const pushBrowsers = await AppDataSource.getRepository(AdminPushSubscription).count({
        where: { adminUserId: admin.id },
      });
      return sendSuccessResponse(res, {
        preferences: resolvePreferences(admin.notificationPreferences),
        // Only the events this admin's role may receive (billing is super admin only)
        availableEvents: ADMIN_ALERT_EVENTS.filter((e) => EVENT_ROLES[e].includes(admin.role)),
        bellUnsupported: BELL_UNSUPPORTED,
        vapidPublicKey: adminAlertService.getVapidPublicKey(),
        pushBrowsers,
      });
    } catch (e) {
      next(e);
    }
  },

  async putPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = AppDataSource.getRepository(AdminUser);
      const admin = await repo.findOneByOrFail({ id: req.admin!.id });
      // resolvePreferences whitelists events/channels and coerces values
      admin.notificationPreferences = resolvePreferences(req.body?.preferences);
      await repo.save(admin);
      return sendSuccessResponse(res, { preferences: admin.notificationPreferences });
    } catch (e) {
      next(e);
    }
  },

  async subscribePush(req: Request, res: Response, next: NextFunction) {
    try {
      const { endpoint, keys } = req.body ?? {};
      if (
        typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 500 ||
        typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string'
      ) {
        return res.status(400).json({ success: false, error: { message: 'Invalid push subscription' } });
      }
      const repo = AppDataSource.getRepository(AdminPushSubscription);
      // Upsert by endpoint: a browser re-subscribing (or switching admin) replaces its row
      await repo.delete({ endpoint });
      await repo.save(
        repo.create({
          adminUserId: req.admin!.id,
          endpoint,
          p256dh: keys.p256dh.slice(0, 255),
          auth: keys.auth.slice(0, 255),
          userAgent: String(req.headers['user-agent'] ?? '').slice(0, 255) || null,
        }),
      );
      return sendSuccessResponse(res, { subscribed: true });
    } catch (e) {
      next(e);
    }
  },

  async unsubscribePush(req: Request, res: Response, next: NextFunction) {
    try {
      const endpoint = req.body?.endpoint;
      if (typeof endpoint === 'string') {
        await AppDataSource.getRepository(AdminPushSubscription).delete({
          endpoint,
          adminUserId: req.admin!.id,
        });
      }
      return sendSuccessResponse(res, { subscribed: false });
    } catch (e) {
      next(e);
    }
  },

  /** Send a test push to the calling admin's browsers only. */
  async testPush(req: Request, res: Response, next: NextFunction) {
    try {
      if (!adminAlertService.getVapidPublicKey()) {
        return res.status(503).json({
          success: false,
          error: { message: 'Web push is not configured on the server (VAPID keys missing)' },
        });
      }
      const sent = await adminAlertService.sendTestPush(req.admin!.id);
      return sendSuccessResponse(res, { sent });
    } catch (e) {
      next(e);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await AppDataSource.getRepository(AdminAlert).update(
        { id: req.params.id, adminUserId: req.admin!.id },
        { readAt: new Date() },
      );
      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await AppDataSource.getRepository(AdminAlert).update(
        { adminUserId: req.admin!.id, readAt: IsNull() },
        { readAt: new Date() },
      );
      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },
};
