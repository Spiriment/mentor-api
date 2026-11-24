import { userPushTokenService } from './userPushToken.service';
import { deadTokensFromTickets, deviceTokensToSend } from '@/common/pushDevices';
import {
  Expo,
  ExpoPushMessage,
  ExpoPushTicket,
  ExpoPushReceipt,
} from 'expo-server-sdk';
import { Logger } from '../common';
import { Config } from '../config';
import { AppDataSource } from '@/config/data-source';

/**
 * Unread messages + unread in-app notifications per user: the number on the app icon.
 * Messages are counted exactly like ChatService.getUnreadMessageCount (active conversations,
 * messages from others after the user's last-read message) so the icon matches the app.
 * Two grouped queries however many users, so broadcasts stay cheap.
 */
export async function getAppBadgeCounts(userIds: string[]): Promise<Map<string, number>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const counts = new Map<string, number>(ids.map((id) => [id, 0]));
  if (!ids.length) return counts;

  const [notificationRows, messageRows] = await Promise.all([
    AppDataSource.query(
      `SELECT n.userId AS userId, COUNT(*) AS n
         FROM app_notifications n
        WHERE n.isRead = 0 AND n.userId IN (?)
        GROUP BY n.userId`,
      [ids]
    ),
    AppDataSource.query(
      `SELECT p.userId AS userId, COUNT(m.id) AS n
         FROM conversation_participants p
         JOIN messages m
           ON m.conversationId = p.conversationId AND m.senderId <> p.userId
         LEFT JOIN messages lastRead ON lastRead.id = p.lastReadMessageId
        WHERE p.userId IN (?) AND p.status = 'active'
          AND (lastRead.id IS NULL OR m.sentAt > lastRead.sentAt)
        GROUP BY p.userId`,
      [ids]
    ),
  ]);
  for (const row of [...notificationRows, ...messageRows] as { userId: string; n: number | string }[]) {
    counts.set(row.userId, (counts.get(row.userId) ?? 0) + Number(row.n || 0));
  }
  return counts;
}

export interface PushNotificationData {
  userId: string;
  pushToken: string;
  title: string;
  body: string;
  data?: any;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  /** Devices to leave out (e.g. ones already ringing through the live connection) */
  excludePushTokens?: string[];
}

export class PushNotificationService {
  private expo: Expo;
  private logger: Logger;

  constructor() {
    this.expo = new Expo({ accessToken: Config.expo.accessToken });
    this.logger = new Logger({
      service: 'push-notification-service',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Fill in the icon badge (unread total) for pushes that don't set one. Never blocks a push:
   * if counting fails, the push goes out without a badge.
   */
  private async withBadges(notifications: PushNotificationData[]): Promise<PushNotificationData[]> {
    const missing = notifications.filter((n) => n.badge === undefined && n.userId);
    if (!missing.length) return notifications;
    try {
      const counts = await getAppBadgeCounts(missing.map((n) => n.userId));
      return notifications.map((n) =>
        n.badge === undefined && n.userId ? { ...n, badge: counts.get(n.userId) ?? 0 } : n
      );
    } catch (error) {
      this.logger.warn(
        `Could not count unread items for the app badge: ${error instanceof Error ? error.message : String(error)}`
      );
      return notifications;
    }
  }

  /**
   * Send a push notification to a single user
   */
  async sendToUser(input: PushNotificationData): Promise<boolean> {
    try {
      const [notification] = await this.withBadges([input]);
      // Every device the person is signed in on, not only the last one to open the app
      const stored = notification.userId ? await this.storedDevices(notification.userId) : [];
      const tokens = deviceTokensToSend(notification.pushToken, stored, notification.excludePushTokens);
      if (!tokens.length) {
        this.logger.warn(`No valid push token for user ${notification.userId}`);
        return false;
      }

      const tickets = await this.sendMessages(tokens.map((to) => this.toMessage(notification, to)));
      await this.pruneDead(tokens, tickets);

      let delivered = 0;
      tickets.forEach((ticket) => {
        if (ticket?.status === 'ok') delivered++;
        else if (ticket?.status === 'error') {
          this.logger.error(
            `Error sending push notification: ${ticket.message}`,
            ticket.details ? new Error(JSON.stringify(ticket.details)) : undefined,
          );
        }
      });
      if (delivered) {
        this.logger.info(`Push notification sent to user ${notification.userId} (${delivered}/${tokens.length} devices)`);
      }
      return delivered > 0;
    } catch (error) {
      this.logger.error(
        'Error in sendToUser',
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /** The person's devices; if that lookup fails (e.g. migration not run yet), just the passed token */
  private async storedDevices(userId: string): Promise<string[]> {
    try {
      return await userPushTokenService.tokensFor(userId);
    } catch (error) {
      this.logger.warn(`Device tokens unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private toMessage(notification: PushNotificationData, to: string): ExpoPushMessage {
    return {
      to,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      channelId: notification.channelId || 'default',
      priority: notification.priority || 'high',
    };
  }

  /** Send in chunks; tickets line up with `messages` (undefined where a chunk failed) */
  private async sendMessages(messages: ExpoPushMessage[]): Promise<Array<ExpoPushTicket | undefined>> {
    const tickets: Array<ExpoPushTicket | undefined> = [];
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        tickets.push(...(await this.expo.sendPushNotificationsAsync(chunk)));
      } catch (error) {
        tickets.push(...chunk.map(() => undefined));
        this.logger.error(
          'Error sending push notification chunk',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
    return tickets;
  }

  /** Forget devices the app was removed from, so we stop sending to them */
  private async pruneDead(tokens: string[], tickets: Array<ExpoPushTicket | undefined>) {
    const dead = deadTokensFromTickets(tokens, tickets as any);
    if (!dead.length) return;
    try {
      await userPushTokenService.removeDead(dead);
      this.logger.info(`Removed ${dead.length} push token(s) for uninstalled apps`);
    } catch (error) {
      this.logger.warn(`Could not remove dead push tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send push notifications to multiple users
   */
  async sendToMany(input: PushNotificationData[]): Promise<void> {
    try {
      const notifications = await this.withBadges(input);
      let devices = new Map<string, string[]>();
      try {
        devices = await userPushTokenService.tokensForMany(notifications.map((n) => n.userId).filter(Boolean));
      } catch (error) {
        // e.g. the user_push_tokens migration hasn't run yet: send to the passed tokens only
        this.logger.warn(`Device tokens unavailable: ${error instanceof Error ? error.message : String(error)}`);
      }
      const messages: ExpoPushMessage[] = [];
      const tokens: string[] = [];
      for (const notification of notifications) {
        for (const to of deviceTokensToSend(
          notification.pushToken,
          devices.get(notification.userId) ?? [],
          notification.excludePushTokens,
        )) {
          messages.push(this.toMessage(notification, to));
          tokens.push(to);
        }
      }

      if (messages.length === 0) {
        this.logger.warn('No valid push tokens found');
        return;
      }

      const tickets = await this.sendMessages(messages);
      await this.pruneDead(tokens, tickets);
      for (const ticket of tickets) {
        if (ticket?.status === 'error') {
          this.logger.error(
            `Error in batch: ${ticket.message}`,
            ticket.details ? new Error(JSON.stringify(ticket.details)) : undefined,
          );
        }
      }

      this.logger.info(`Batch push notifications sent: ${messages.length} messages`);
    } catch (error) {
      this.logger.error(
        'Error in sendToMany',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Send a session reminder notification
   */
  async sendSessionReminder(
    pushToken: string,
    userId: string,
    otherPartyName: string,
    sessionTime: string,
    minutesBefore: number,
    sessionContext?: {
      sessionId: string;
      mentorId?: string;
      menteeId?: string;
      mentorName?: string;
      menteeName?: string;
      mentorImage?: string;
      menteeImage?: string;
    },
  ): Promise<boolean> {
    const title =
      minutesBefore === 60
        ? 'Session Starting Soon'
        : minutesBefore === 15
          ? 'Session Starting in 15 Minutes'
          : 'Session Starting Now';

    const body =
      minutesBefore === 60
        ? `Your session with ${otherPartyName} starts in 1 hour at ${sessionTime}`
        : minutesBefore === 15
          ? `Your session with ${otherPartyName} starts in 15 minutes at ${sessionTime}`
          : `Your session with ${otherPartyName} is starting now! Tap to join.`;

    const canJoin = minutesBefore === 0 || minutesBefore === 15;

    return this.sendToUser({
      userId,
      pushToken,
      title,
      body,
      data: {
        type: 'session_reminder',
        minutesBefore,
        ...(sessionContext ?? {}),
        ...(canJoin && sessionContext?.sessionId ? { canJoin: true } : {}),
      },
      channelId: 'session-reminders',
    });
  }

  /**
   * Send a new message notification
   */
  async sendNewMessageNotification(
    pushToken: string,
    userId: string,
    senderName: string,
    messagePreview: string,
    context?: {
      conversationId?: string;
      senderId?: string;
      senderImage?: string;
    },
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: senderName,
      body: messagePreview,
      data: {
        type: 'new_message',
        senderName,
        ...(context ?? {}),
      },
      channelId: 'messages',
    });
  }

  /**
   * Send a mentorship request notification
   */
  async sendMentorshipRequestNotification(
    pushToken: string,
    userId: string,
    menteeName: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'New Mentorship Request',
      body: `${menteeName} has requested you as their mentor`,
      data: { type: 'mentorship_request' },
      channelId: 'mentorship-requests',
    });
  }

  /**
   * Send mentorship accepted notification
   */
  async sendMentorshipAcceptedNotification(
    pushToken: string,
    userId: string,
    mentorName: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'Mentorship Accepted',
      body: `${mentorName} has accepted your mentorship request!`,
      data: { type: 'mentorship_accepted' },
      channelId: 'mentorship-requests',
    });
  }

  /**
   * Send mentorship declined notification
   */
  async sendMentorshipDeclinedNotification(
    pushToken: string,
    userId: string,
    mentorName: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'Mentorship Request Declined',
      body: `${mentorName} has declined your mentorship request`,
      data: { type: 'mentorship_declined' },
      channelId: 'mentorship-requests',
    });
  }

  /**
   * Send a welcome notification
   */
  async sendWelcomeNotification(
    pushToken: string,
    userId: string,
    userName: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'Welcome to Spiriment!',
      body: `Hi ${userName}, we're glad to have you! Explore the app to find your perfect mentorship match.`,
      data: { type: 'welcome' },
      channelId: 'default',
    });
  }

  /**
   * Send mentor approval notification
   */
  async sendMentorApprovalNotification(
    pushToken: string,
    userId: string,
    userName: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'Profile Approved!',
      body: `Congratulations ${userName}, your mentor profile has been approved! You are now visible to mentees.`,
      data: { type: 'mentor_approval' },
      channelId: 'default',
    });
  }

  /**
   * Send session request notification
   */
  async sendSessionRequestNotification(
    pushToken: string,
    userId: string,
    menteeName: string,
    sessionTime: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'New Session Request',
      body: `${menteeName} has requested a session for ${sessionTime}.`,
      data: { type: 'session_request' },
      channelId: 'session-reminders',
    });
  }

  /**
   * Send session status update notification
   */
  async sendSessionStatusNotification(
    pushToken: string,
    userId: string,
    partnerName: string,
    status: 'accepted' | 'declined' | 'rescheduled',
    sessionTime: string,
  ): Promise<boolean> {
    let title = '';
    let body = '';

    switch (status) {
      case 'accepted':
        title = '✅ Session Accepted';
        body = `${partnerName} has accepted your session on ${sessionTime}.`;
        break;
      case 'declined':
        title = '❌ Session Declined';
        body = `${partnerName} has declined your session request for ${sessionTime}.`;
        break;
      case 'rescheduled':
        title = '📅 Session Rescheduled';
        body = `${partnerName} has requested to reschedule the session for ${sessionTime}.`;
        break;
    }

    return this.sendToUser({
      userId,
      pushToken,
      title,
      body,
      data: { type: 'session_status_update', status },
      channelId: 'session-reminders',
    });
  }

  /**
   * Send call invite notification for offline users
   */
  async sendCallInviteNotification(
    pushToken: string,
    userId: string,
    callData: {
      callerId: string;
      callerName: string;
      callerImage?: string;
      sessionId?: string;
      conversationId: string;
      isSessionCall?: boolean;
    },
    /** Devices already ringing through the live connection */
    excludePushTokens: string[] = [],
  ): Promise<boolean> {
    const callLabel = callData.isSessionCall ? 'session call' : 'call';
    return this.sendToUser({
      userId,
      pushToken,
      excludePushTokens,
      title: `Incoming ${callLabel} from ${callData.callerName}`,
      body: 'Tap to answer',
      data: {
        type: 'call-invite',
        callerId: callData.callerId,
        callerName: callData.callerName,
        callerImage: callData.callerImage,
        sessionId: callData.sessionId,
        conversationId: callData.conversationId,
        isSessionCall: callData.isSessionCall,
      },
      channelId: 'calls',
      priority: 'high',
      sound: 'default',
    });
  }

  /**
   * Send a missed session notification
   */
  async sendMissedSessionNotification(
    pushToken: string,
    userId: string,
    sessionTitle: string,
    scheduledTime: string,
    sessionId: string,
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: 'Missed Session',
      body: `You missed "${sessionTitle}" scheduled for ${scheduledTime}. Would you like to reschedule?`,
      data: { type: 'missed_session', sessionId },
      channelId: 'session-reminders',
    });
  }
}

export const pushNotificationService = new PushNotificationService();
