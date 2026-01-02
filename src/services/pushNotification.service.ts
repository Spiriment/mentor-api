import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { Logger } from '../common';

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
}

export class PushNotificationService {
  private expo: Expo;
  private logger: Logger;

  constructor() {
    this.expo = new Expo();
    this.logger = new Logger({
      service: 'push-notification-service',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Send a push notification to a single user
   */
  async sendToUser(notification: PushNotificationData): Promise<boolean> {
    try {
      // Check if the token is a valid Expo push token
      if (!Expo.isExpoPushToken(notification.pushToken)) {
        this.logger.warn(`Push token ${notification.pushToken} is not a valid Expo push token`);
        return false;
      }

      const message: ExpoPushMessage = {
        to: notification.pushToken,
        sound: notification.sound || 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        badge: notification.badge,
        channelId: notification.channelId || 'default',
        priority: notification.priority || 'high',
      };

      const chunks = this.expo.chunkPushNotifications([message]);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error('Error sending push notification chunk', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Check for errors in tickets
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          this.logger.error(`Error sending push notification: ${ticket.message}`,
            ticket.details ? new Error(JSON.stringify(ticket.details)) : undefined
          );
          return false;
        }
      }

      this.logger.info(`Push notification sent successfully to user ${notification.userId}`);
      return true;
    } catch (error) {
      this.logger.error('Error in sendToUser', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Send push notifications to multiple users
   */
  async sendToMany(notifications: PushNotificationData[]): Promise<void> {
    try {
      const messages: ExpoPushMessage[] = [];

      for (const notification of notifications) {
        if (!Expo.isExpoPushToken(notification.pushToken)) {
          this.logger.warn(`Push token ${notification.pushToken} is not a valid Expo push token`);
          continue;
        }

        messages.push({
          to: notification.pushToken,
          sound: notification.sound || 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          badge: notification.badge,
          channelId: notification.channelId || 'default',
          priority: notification.priority || 'high',
        });
      }

      if (messages.length === 0) {
        this.logger.warn('No valid push tokens found');
        return;
      }

      // Chunk messages to avoid rate limiting
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error('Error sending push notification chunk', error instanceof Error ? error : new Error(String(error)));
        }
      }

      // Log any errors
      for (const ticket of tickets) {
        if (ticket.status === 'error') {
          this.logger.error(`Error in batch: ${ticket.message}`,
            ticket.details ? new Error(JSON.stringify(ticket.details)) : undefined
          );
        }
      }

      this.logger.info(`Batch push notifications sent: ${messages.length} messages`);
    } catch (error) {
      this.logger.error('Error in sendToMany', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send a session reminder notification
   */
  async sendSessionReminder(
    pushToken: string,
    userId: string,
    mentorName: string,
    sessionTime: string,
    minutesBefore: number
  ): Promise<boolean> {
    const title = minutesBefore === 60
      ? '⏰ Session Starting Soon'
      : '⏰ Session Starting in 15 Minutes';

    const body = minutesBefore === 60
      ? `Your session with ${mentorName} starts in 1 hour at ${sessionTime}`
      : `Your session with ${mentorName} starts in 15 minutes at ${sessionTime}`;

    return this.sendToUser({
      userId,
      pushToken,
      title,
      body,
      data: { type: 'session_reminder', minutesBefore },
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
    messagePreview: string
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: `💬 ${senderName}`,
      body: messagePreview,
      data: { type: 'new_message', senderName },
      channelId: 'messages',
    });
  }

  /**
   * Send a mentorship request notification
   */
  async sendMentorshipRequestNotification(
    pushToken: string,
    userId: string,
    menteeName: string
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: '🙏 New Mentorship Request',
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
    mentorName: string
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: '✅ Mentorship Accepted',
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
    mentorName: string
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: '❌ Mentorship Request Declined',
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
    userName: string
  ): Promise<boolean> {
    return this.sendToUser({
      userId,
      pushToken,
      title: '🌟 Welcome to Spiriment!',
      body: `Hi ${userName}, we're glad to have you! Explore the app to find your perfect mentorship match.`,
      data: { type: 'welcome' },
      channelId: 'default',
    });
  }
}

export const pushNotificationService = new PushNotificationService();
