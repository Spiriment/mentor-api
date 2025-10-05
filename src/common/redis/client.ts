import Redis from "ioredis";
import { RedisConfig, RedisService, CacheOptions } from "./types";
import { Logger } from "../logger";

export class RedisClient implements RedisService {
  private client: Redis;
  private logger: Logger;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: RedisConfig, logger: Logger) {
    this.logger = logger;

    this.client = new Redis({
      host: config.host,
      username: config.username,
      port: config.port,
      password: config.password,
      db: config.db,
      connectTimeout: 30000,
      maxRetriesPerRequest: null,
      family: 4,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
      enableReadyCheck: true,
      keepAlive: 30000,
      lazyConnect: true, // Don't connect immediately
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on("error", (error: Error) => {
      this.logger.error("Redis client error:", error);

      // Handle specific connection errors
      if (
        error.message?.includes("ECONNRESET") ||
        error.message?.includes("Connection")
      ) {
        this.logger.warn(
          "Connection reset detected, Redis will attempt to reconnect"
        );
      }
    });

    this.client.on("connect", () => {
      this.logger.info("Redis client connected");
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    });

    this.client.on("ready", () => {
      this.logger.info("Redis client ready");
    });

    this.client.on("close", () => {
      this.logger.warn("Redis client connection closed");
    });

    this.client.on("reconnecting", (delay: number) => {
      this.reconnectAttempts++;
      this.logger.info(
        `Redis client reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.logger.error(
          "Max reconnection attempts reached. Consider checking Redis server status."
        );
      }
    });

    this.client.on("end", () => {
      this.logger.warn("Redis client connection ended");
    });

    this.client.on("node error", (error: Error) => {
      this.logger.error("Redis node error:", error);
    });
  }

  get getClient(): Redis {
    return this.client;
  }

  private defaultRetryStrategy(times: number): number | null {
    // Exponential backoff with max delay of 30 seconds
    const delay = Math.min(times * 1000, 30000);
    return delay;
  }

  private getFullKey(key: string, options?: CacheOptions): string {
    const prefix = options?.prefix || "";
    return prefix ? `${prefix}:${key}` : key;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data: any = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error: unknown) {
      this.logger.error(
        "Redis get error:",
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    options?: CacheOptions
  ): Promise<void> {
    try {
      const fullKey = this.getFullKey(key, options);
      const serializedValue = JSON.stringify(value);

      if (options?.ttl) {
        await this.client.setex(fullKey, options.ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }
    } catch (error: unknown) {
      this.logger.error(
        "Redis set error:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error: unknown) {
      this.logger.error(
        "Redis del error:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error: unknown) {
      this.logger.error(
        "Redis exists error:",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error: unknown) {
      this.logger.error(
        "Redis ttl error:",
        error instanceof Error ? error : new Error(String(error))
      );
      return -2;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error: unknown) {
      this.logger.error(
        "Redis keys error:",
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (error: unknown) {
      this.logger.error(
        "Redis flush error:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async quit(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error: unknown) {
      this.logger.error(
        "Redis quit error:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error: unknown) {
      this.logger.error(
        "Redis health check failed:",
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isConnected(): boolean {
    return this.client.status === "ready";
  }

  getConnectionStatus(): string {
    return this.client.status;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get hash field value
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error: unknown) {
      this.logger.error(
        "Redis hget error:",
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Set hash field value
   */
  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hset(key, field, value);
    } catch (error: unknown) {
      this.logger.error(
        "Redis hset error:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Set key with expiration
   */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    try {
      await this.client.setex(key, seconds, value);
    } catch (error: unknown) {
      this.logger.error(
        "Redis setex error:",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}
