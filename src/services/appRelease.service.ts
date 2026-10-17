import { In, IsNull, Not } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { AppError } from '@/common';
import {
  APP_STORE_URLS,
  type AppPlatform,
  compareVersions,
  isOutdated,
  parseAppReleaseConfig,
} from '@/common/appRelease';
import { adminSpirimentSettingsService } from './adminSpirimentSettings.service';
import { PushNotificationService } from './pushNotification.service';
import { adminAuditService } from './adminAudit.service';
import { logger } from '@/config/int-services';

/** Builds before 1.0.5 never reported a platform, so they get a store-neutral message. */
type Audience = AppPlatform | 'unknown';

const DEFAULT_MESSAGES: Record<Audience, (version: string) => { title: string; body: string }> = {
  ios: (v) => ({
    title: 'Update available',
    body: `Spiriment ${v} is on the App Store with fixes and improvements. Tap to update.`,
  }),
  android: (v) => ({
    title: 'Update available',
    body: `Spiriment ${v} is on Google Play with fixes and improvements. Tap to update.`,
  }),
  // These builds can't open a store link from a push, so the text has to say where to go
  unknown: () => ({
    title: 'Update available',
    body: 'A new version of Spiriment is available. Update it from the App Store or Google Play to get the latest fixes.',
  }),
};

export interface NotifyUpdateResult {
  dryRun: boolean;
  counts: Record<Audience, number>;
}

export class AppReleaseService {
  private push = new PushNotificationService();

  async getConfig() {
    const settings = await adminSpirimentSettingsService.getGlobal();
    return parseAppReleaseConfig(settings.data.appRelease);
  }

  /** Public payload for the app's launch-time update check. */
  async getPublicVersionInfo() {
    const config = await this.getConfig();
    return {
      ios: { ...config.ios, storeUrl: APP_STORE_URLS.ios },
      android: { ...config.android, storeUrl: APP_STORE_URLS.android },
    };
  }

  /**
   * Push "update available" to users on the given platforms whose app is older than that
   * platform's configured latest version. Users with no recorded platform (pre-1.0.5
   * builds) are only included when notifying both platforms, since we can't tell which
   * store they use. `dryRun` returns the counts without sending anything.
   */
  async notifyUpdate(params: {
    platforms: AppPlatform[];
    dryRun: boolean;
    adminUserId: string;
    ip?: string;
  }): Promise<NotifyUpdateResult> {
    const config = await this.getConfig();
    const platforms = Array.from(new Set(params.platforms));
    for (const p of platforms) {
      if (!config[p].latestVersion) {
        throw new AppError(`Set the latest ${p} version in Settings before notifying users`, 400);
      }
    }
    const includeUnknown = platforms.includes('ios') && platforms.includes('android');

    const users = await AppDataSource.getRepository(User).find({
      where: [
        { pushToken: Not(IsNull()), pushNotificationsEnabled: true, pushPlatform: In(platforms) },
        ...(includeUnknown
          ? [{ pushToken: Not(IsNull()), pushNotificationsEnabled: true, pushPlatform: IsNull() }]
          : []),
      ],
      select: ['id', 'pushToken', 'pushPlatform', 'appVersion'],
    });

    const counts: Record<Audience, number> = { ios: 0, android: 0, unknown: 0 };
    const messages = [];
    for (const user of users) {
      const platform = user.pushPlatform === 'ios' || user.pushPlatform === 'android'
        ? user.pushPlatform
        : null;
      const audience: Audience = platform ?? 'unknown';
      // Unknown-platform users are pre-1.0.5 by definition; compare against the lower latest
      const latest = platform
        ? config[platform].latestVersion!
        : compareVersions(config.ios.latestVersion!, config.android.latestVersion!) <= 0
          ? config.ios.latestVersion!
          : config.android.latestVersion!;
      if (!isOutdated(user.appVersion, latest)) continue;

      counts[audience]++;
      const { title, body } = DEFAULT_MESSAGES[audience](latest);
      messages.push({
        userId: user.id,
        pushToken: user.pushToken!,
        title,
        body,
        data: platform
          ? { type: 'app_update', platform, version: latest, url: APP_STORE_URLS[platform] }
          : { type: 'app_update' },
      });
    }

    if (!params.dryRun && messages.length > 0) {
      await this.push.sendToMany(messages);
      logger.info('App update push sent', { counts, platforms });
    }

    await adminAuditService.log({
      adminUserId: params.adminUserId,
      action: params.dryRun ? 'admin.app_update_push.preview' : 'admin.app_update_push.send',
      targetType: 'spiriment_settings',
      targetId: 'global',
      metadata: { platforms, counts },
      ip: params.ip ?? null,
    });

    return { dryRun: params.dryRun, counts };
  }
}

export const appReleaseService = new AppReleaseService();
