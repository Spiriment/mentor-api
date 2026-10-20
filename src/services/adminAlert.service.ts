import webpush from 'web-push';
import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { AdminUser } from '@/database/entities/adminUser.entity';
import { AdminAlert } from '@/database/entities/adminAlert.entity';
import { AdminPushSubscription } from '@/database/entities/adminPushSubscription.entity';
import { EmailService } from '@/core/email.service';
import { logger } from '@/config/int-services';
import { type AdminAlertEvent, channelsFor } from '@/common/adminAlerts';

export interface AdminAlertPayload {
  title: string;
  body: string;
  /** Portal path, e.g. /support/<ticketId> */
  link?: string;
}

/**
 * VAPID keys are read lazily — at first use, not import time — so this works regardless of
 * when the environment is loaded relative to module imports. Without keys, web push is off
 * and the other channels still work.
 */
let vapidPublicKey: string | null | undefined;
function vapidKey(): string | null {
  if (vapidPublicKey !== undefined) return vapidPublicKey;
  const pub = process.env.ADMIN_VAPID_PUBLIC_KEY ?? '';
  const priv = process.env.ADMIN_VAPID_PRIVATE_KEY ?? '';
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.ADMIN_VAPID_SUBJECT || 'mailto:support@spiriment.com',
      pub,
      priv,
    );
    vapidPublicKey = pub;
  } else {
    logger.warn(
      'ADMIN_VAPID_PUBLIC_KEY / ADMIN_VAPID_PRIVATE_KEY not set — admin web push disabled',
    );
    vapidPublicKey = null;
  }
  return vapidPublicKey;
}

let emailSingleton: EmailService | null = null;
const email = () => (emailSingleton ??= new EmailService(null));
const portalUrl = (link?: string) =>
  `${process.env.FRONTEND_ADMIN_URL || 'http://localhost:3002'}${link ?? '/'}`;

export class AdminAlertService {
  getVapidPublicKey(): string | null {
    return vapidKey();
  }

  /**
   * Notify every admin who opted in to `event`, on each channel they chose.
   * Never throws and doesn't block the caller's work — call it with `void`, so a slow email
   * or a dead browser subscription can't fail a payment webhook or a ticket submission.
   */
  async notify(
    event: AdminAlertEvent,
    payload: AdminAlertPayload,
  ): Promise<void> {
    try {
      const admins = await AppDataSource.getRepository(AdminUser).find({
        where: { isActive: true },
      });
      const targets = admins
        .map((admin) => ({ admin, channels: channelsFor(admin, event) }))
        .filter((t) => t.channels.length > 0);
      if (targets.length === 0) return;

      const bellIds = targets
        .filter((t) => t.channels.includes('bell'))
        .map((t) => t.admin.id);
      if (bellIds.length) {
        const repo = AppDataSource.getRepository(AdminAlert);
        await repo.save(
          bellIds.map((adminUserId) =>
            repo.create({
              adminUserId,
              type: event,
              ...payload,
              link: payload.link ?? null,
            }),
          ),
        );
      }

      const pushIds = targets
        .filter((t) => t.channels.includes('push'))
        .map((t) => t.admin.id);
      if (pushIds.length && vapidKey()) await this.sendPush(pushIds, payload);

      for (const t of targets.filter((t) => t.channels.includes('email'))) {
        await email()
          .sendNotificationEmail({
            to: t.admin.email,
            subject: `[Spiriment admin] ${payload.title}`,
            message: payload.body,
            userName: t.admin.firstName ?? undefined,
            actionUrl: portalUrl(payload.link),
            actionText: 'Open admin portal',
          })
          .catch((err) => logger.error('Admin alert email failed', err));
      }
    } catch (err) {
      logger.error('Admin alert dispatch failed', err as Error, { event });
    }
  }

  /** Push a test notification to one admin's browsers; returns how many browsers it targeted. */
  async sendTestPush(adminId: string): Promise<number> {
    const count = await AppDataSource.getRepository(
      AdminPushSubscription,
    ).count({
      where: { adminUserId: adminId },
    });
    if (count > 0 && vapidKey()) {
      await this.sendPush([adminId], {
        title: 'Test notification',
        body: 'Browser notifications are working for your Spiriment admin account.',
        link: '/profile',
      });
    }
    return count;
  }

  private async sendPush(adminIds: string[], payload: AdminAlertPayload) {
    const repo = AppDataSource.getRepository(AdminPushSubscription);
    const subs = await repo.find({ where: { adminUserId: In(adminIds) } });
    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.link ?? '/',
    });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
            { TTL: 60 * 60 * 24 },
          );
        } catch (err: any) {
          // 404/410: the browser revoked or expired this subscription — stop sending to it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await repo.delete({ id: sub.id });
          } else {
            logger.error('Admin web push failed', err as Error);
          }
        }
      }),
    );
  }
}

export const adminAlertService = new AdminAlertService();
