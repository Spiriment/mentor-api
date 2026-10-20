import { IsNull, Not } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/int-services';
import { User } from '@/database/entities/user.entity';
import { getEmailService } from '@/services/emailHelper';
import { pushNotificationService } from '@/services/pushNotification.service';
import { ChurchPortal } from '../entities/churchPortal.entity';
import { ChurchPortalUser } from '../entities/churchPortalUser.entity';
import { ChurchPortalJoinRequest, CHURCH_JOIN_REQUEST_STATUS } from '../entities/churchPortalJoinRequest.entity';

/** At most one "new join request" email per church per hour; the email shows the pending count */
const JOIN_REQUEST_EMAIL_INTERVAL_MS = 60 * 60 * 1000;

const portalBaseUrl = () => process.env.CHURCH_PORTAL_URL || 'https://admin.spiriment.com';

const displayName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || 'Someone';

/**
 * Email the church's pastors that someone asked to join. Fire-and-forget: never delays or
 * fails the member's request.
 */
export function notifyPastorsOfJoinRequest(churchPortalId: string, requesterUserId: string): void {
  void (async () => {
    // Claim the hourly slot under a row lock so two requests in the same second send one email
    const portal = await AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ChurchPortal);
      const row = await repo.findOne({ where: { id: churchPortalId }, lock: { mode: 'pessimistic_write' } });
      if (!row) return null;
      const last = Date.parse(String(row.metadata?.lastJoinRequestEmailAt ?? ''));
      if (Number.isFinite(last) && Date.now() - last < JOIN_REQUEST_EMAIL_INTERVAL_MS) return null;
      row.metadata = { ...(row.metadata ?? {}), lastJoinRequestEmailAt: new Date().toISOString() };
      await repo.save(row);
      return row;
    });
    if (!portal) return;

    const [pastors, requester, pendingCount] = await Promise.all([
      AppDataSource.getRepository(ChurchPortalUser).find({
        // Only pastors who finished setting up their account can act on it
        where: { churchPortalId, isActive: true, password: Not(IsNull()) },
        select: ['id', 'email', 'firstName'],
      }),
      AppDataSource.getRepository(User).findOne({
        where: { id: requesterUserId },
        select: ['id', 'firstName', 'lastName', 'email'],
      }),
      AppDataSource.getRepository(ChurchPortalJoinRequest).count({
        where: { churchPortalId, status: CHURCH_JOIN_REQUEST_STATUS.PENDING },
      }),
    ]);

    const emailService = getEmailService();
    for (const pastor of pastors) {
      await emailService
        .sendEmailWithTemplate({
          to: pastor.email,
          subject: `New request to join ${portal.name}`,
          partialName: 'church-join-request',
          templateData: {
            name: pastor.firstName || 'Pastor',
            churchName: portal.name,
            requesterName: requester ? displayName(requester) : 'Someone',
            pendingCount,
            hasSeveralPending: pendingCount > 1,
            reviewUrl: `${portalBaseUrl()}/church/${portal.slug}/join-requests`,
          },
        })
        .catch((err) =>
          logger.warn('Church join request email failed', {
            churchPortalId,
            pastorId: pastor.id,
            error: err instanceof Error ? err.message : String(err),
          })
        );
    }
  })().catch((err) =>
    logger.error('Church join request notification failed', err instanceof Error ? err : new Error(String(err)), {
      churchPortalId,
    })
  );
}

/** Push the member the pastor's decision. Fire-and-forget. */
export function notifyMemberOfJoinDecision(userId: string, churchName: string, approved: boolean): void {
  void (async () => {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'pushToken', 'pushNotificationsEnabled'],
    });
    if (!user?.pushToken || user.pushNotificationsEnabled === false) return;
    await pushNotificationService.sendToUser({
      userId,
      pushToken: user.pushToken,
      title: approved ? `Welcome to ${churchName}` : 'Church request not approved',
      body: approved
        ? `Your pastor approved your request. Your church discount now applies to new subscriptions.`
        : `${churchName} didn't approve your request. You can check the code with your pastor and try again.`,
      data: { type: approved ? 'church_join_approved' : 'church_join_declined' },
      channelId: 'default',
    });
  })().catch((err) =>
    logger.warn('Church join decision push failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}

/** Push the member that their church now pays for their plan. Fire-and-forget. */
export function notifyMemberCovered(userId: string, churchName: string, tier: string): void {
  void (async () => {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'pushToken', 'pushNotificationsEnabled'],
    });
    if (!user?.pushToken || user.pushNotificationsEnabled === false) return;
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    await pushNotificationService.sendToUser({
      userId,
      pushToken: user.pushToken,
      title: `${churchName} covers your ${tierLabel} plan`,
      body: `Your church now pays for Spiriment ${tierLabel}. Everything in it is unlocked, with nothing to pay in the app.`,
      data: { type: 'church_plan_covered' },
      channelId: 'default',
    });
  })().catch((err) =>
    logger.warn('Church coverage push failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}
