import { Config } from '@/common';
import { Logger } from '@/common/logger';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

export class AgoraService {
  private logger: Logger;
  private appId: string;
  private appCertificate: string | undefined;

  constructor() {
    this.logger = new Logger({
      service: 'agora-service',
      level: process.env.LOG_LEVEL || 'info',
    });
    this.appId = Config.agora.appId;
    this.appCertificate = Config.agora.appCertificate;

    if (!this.appId) {
      this.logger.warn('Agora App ID not configured');
    }
  }

  /**
   * Generate Agora RTC token for video calling
   * @param channelName - Unique channel name (typically session ID)
   * @param userId - User ID (0 for anonymous, or actual user ID)
   * @param role - User role (publisher or subscriber)
   * @param expirationTimeInSeconds - Token expiration time (default: 3600 = 1 hour)
   */
  generateRtcToken(
    channelName: string,
    userId: string | number,
    role: 'publisher' | 'subscriber' = 'publisher',
    expirationTimeInSeconds: number = 3600
  ): string {
    if (!this.appId || !this.appCertificate) {
      throw new Error('Agora App ID or Certificate not configured');
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const tokenExpire = currentTimestamp + expirationTimeInSeconds;
    const privilegeExpire = currentTimestamp + expirationTimeInSeconds;

    const rtcRole =
      role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Convert userId to number if it's a string UUID
    const numericUserId = typeof userId === 'string' ? this.hashUserId(userId) : userId;

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        numericUserId,
        rtcRole,
        tokenExpire,
        privilegeExpire
      );

      this.logger.info('Agora RTC token generated', {
        channelName,
        userId: numericUserId,
        role,
        expirationTimeInSeconds,
      });

      return token;
    } catch (error: any) {
      this.logger.error('Error generating Agora token', error);
      throw new Error(`Failed to generate Agora token: ${error.message}`);
    }
  }

  /**
   * Hash user ID string to numeric value for Agora
   * Agora requires numeric UIDs, so we hash string UUIDs
   */
  hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive number and within Agora's valid range
    return Math.abs(hash) % 2147483647; // Max 32-bit signed integer
  }

  /**
   * Get Agora App ID
   */
  getAppId(): string {
    return this.appId;
  }
}

