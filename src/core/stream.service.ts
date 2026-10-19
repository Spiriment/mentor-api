import { Config } from '@/common';
import { Logger } from '@/common/logger';
import { StreamClient } from '@stream-io/node-sdk';
import { summarizeCallSession, type CallSessionHealth } from '@/common/callHealth';

export class StreamService {
  private logger: Logger;
  private client: StreamClient;

  constructor() {
    this.logger = new Logger({
      service: 'stream-service',
      level: process.env.LOG_LEVEL || 'info',
    });

    const apiKey = Config.stream.apiKey;
    const apiSecret = Config.stream.apiSecret;

    if (!apiKey || !apiSecret) {
      this.logger.warn('Stream API Key or Secret not configured');
      // Create a dummy client if config is missing, it will fail on use
      this.client = new StreamClient('missing', 'missing');
    } else {
      this.client = new StreamClient(apiKey, apiSecret);
    }
  }

  /**
   * Generate Stream JWT token for a user
   * @param userId - Unique user ID
   * @param expirationTimeInSeconds - Token expiration time (default: 3600 = 1 hour)
   */
  generateUserToken(userId: string, expirationTimeInSeconds: number = 3600): string {
    const expiration = Math.floor(Date.now() / 1000) + expirationTimeInSeconds;
    
    try {
      const token = this.client.generateUserToken({ user_id: userId, validity_in_seconds: expirationTimeInSeconds });
      
      this.logger.info('Stream user token generated', {
        userId,
        expirationTimeInSeconds,
      });

      return token;
    } catch (error: any) {
      this.logger.error('Error generating Stream token', error);
      throw new Error(`Failed to generate Stream token: ${error.message}`);
    }
  }

  /**
   * Get Stream API Key
   */
  getApiKey(): string {
    return Config.stream.apiKey;
  }

  /**
   * Per-call-session health (who joined, from which platform, whether their audio/video
   * actually reached the call, connection quality) for the admin Sessions page.
   * Each Stream "call session" is one stretch of the call; rejoining after everyone left
   * starts a new one. Newest first.
   */
  async getCallHealth(
    callId: string,
    roles: { mentorId?: string; menteeId?: string },
  ): Promise<CallSessionHealth[]> {
    const stats = await this.client.video.queryCallStats({
      filter_conditions: { call_cid: `default:${callId}` },
      sort: [{ field: 'created_at', direction: -1 }],
      limit: 10,
    });
    const results: CallSessionHealth[] = [];
    for (const report of stats.reports ?? []) {
      const ps = await this.client.video.queryCallSessionParticipantStats({
        call_type: 'default',
        call_id: callId,
        session: report.call_session_id,
        limit: 25,
      });
      results.push(
        summarizeCallSession(
          {
            sessionId: report.call_session_id,
            startedAt: report.first_stats_time,
            // The summary has no end time; derive it from start + duration
            endedAt: report.first_stats_time
              ? new Date(new Date(report.first_stats_time).getTime() + report.call_duration_seconds * 1000)
              : undefined,
            durationSeconds: report.call_duration_seconds,
            qualityScore: report.quality_score,
            participants: (ps.participants ?? []) as any,
          },
          roles,
        ),
      );
    }
    return results;
  }

  /**
   * Get call report/session details from Stream
   * @param callId - Unique call ID
   */
  async getCallSessionReport(callId: string): Promise<any> {
    try {
      // For one-on-one sessions, call type is usually 'default'
      const call = this.client.video.call('default', callId);
      const response = await call.get();
      
      this.logger.info('Stream call report retrieved', {
        callId,
        participants: response.call.session?.participants?.length || 0,
      });

      return response.call;
    } catch (error: any) {
      this.logger.error('Error getting Stream call report', error, {
        callId
      });
      // Don't throw here, just return null so the caller can handle it gracefully
      return null;
    }
  }
}
