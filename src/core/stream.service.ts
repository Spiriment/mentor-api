import { Config } from '@/common';
import { Logger } from '@/common/logger';
import { StreamClient } from '@stream-io/node-sdk';

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
}
