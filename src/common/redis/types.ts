export interface RedisConfig {
  host: string;
  username: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export interface RedisService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: CacheOptions): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  flush(): Promise<void>;
  quit(): Promise<void>;
  healthCheck(): Promise<boolean>;
  isConnected(): boolean;
  getConnectionStatus(): string;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  setex(key: string, seconds: number, value: string): Promise<void>;
}
