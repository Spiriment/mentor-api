import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { UserPushToken } from '@/database/entities/userPushToken.entity';
import { User } from '@/database/entities/user.entity';

/** Most devices one account sends to (newest first); stops a runaway list from fanning out */
const MAX_DEVICES = 10;

const repo = () => AppDataSource.getRepository(UserPushToken);

/** Keeps users.pushToken = the account's most recent device (or null when none are left) */
async function refreshPrimary(userIds: string[]) {
  for (const userId of [...new Set(userIds)]) {
    const latest = await repo().findOne({ where: { userId }, order: { lastSeenAt: 'DESC' }, select: ['token'] });
    await AppDataSource.getRepository(User).update(userId, { pushToken: latest?.token ?? null });
  }
}

export const userPushTokenService = {
  /** This device is signed in to `userId` (called on every app launch) */
  async register(userId: string, token: string, platform: string | null) {
    const previous = await repo().findOne({ where: { token }, select: ['userId'] });
    await AppDataSource.query(
      `INSERT INTO user_push_tokens (id, userId, token, platform, lastSeenAt)
       VALUES (UUID(), ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE userId = VALUES(userId), platform = COALESCE(VALUES(platform), platform), lastSeenAt = NOW()`,
      [userId, token, platform]
    );
    // The phone was signed in to another account before: that account must stop
    // receiving its notifications here (shared or handed-down phones)
    if (previous && previous.userId !== userId) await refreshPrimary([previous.userId]);
    await AppDataSource.query('UPDATE users SET pushToken = NULL WHERE pushToken = ? AND id <> ?', [token, userId]);
  },

  /**
   * Signed out on one device. App builds before multi-device send no token: then the
   * account's primary device is removed, which is what the old single-token code did.
   */
  async unregister(userId: string, token?: string | null) {
    let target = token;
    if (!target) {
      const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['id', 'pushToken'] });
      target = user?.pushToken ?? null;
    }
    if (target) await repo().delete({ userId, token: target });
    await refreshPrimary([userId]);
  },

  async tokensFor(userId: string): Promise<string[]> {
    const rows = await repo().find({
      where: { userId },
      order: { lastSeenAt: 'DESC' },
      take: MAX_DEVICES,
      select: ['token'],
    });
    return rows.map((r) => r.token);
  },

  async tokensForMany(userIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (!userIds.length) return out;
    const rows = await repo().find({
      where: { userId: In([...new Set(userIds)]) },
      order: { lastSeenAt: 'DESC' },
      select: ['userId', 'token'],
    });
    for (const r of rows) {
      const list = out.get(r.userId) ?? [];
      if (list.length < MAX_DEVICES) list.push(r.token);
      out.set(r.userId, list);
    }
    return out;
  },

  /** Apple/Google say the app is gone from these devices: stop sending to them */
  async removeDead(tokens: string[]) {
    if (!tokens.length) return;
    const rows = await repo().find({ where: { token: In(tokens) }, select: ['userId'] });
    await repo().delete({ token: In(tokens) });
    const legacy = await AppDataSource.getRepository(User).find({ where: { pushToken: In(tokens) }, select: ['id'] });
    await refreshPrimary([...rows.map((r) => r.userId), ...legacy.map((u) => u.id)]);
  },
};
