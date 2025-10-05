import {
  RedisClient,
  Logger,
  JwtService,
  EncryptionServiceImpl,
} from '../common';
import { Config } from '.';

export const logger = new Logger({
  level: Config.logging.level,
  service: 'error-handler',
});

export const jwt = new JwtService(
  Config.jwt.privateKey,
  Config.jwt.publicKey,
  Config.jwt.expiresIn
);

// Mock Redis client for mentor app (Redis not needed)
export const redis = {
  get: async () => null,
  set: async () => {},
  del: async () => {},
  exists: async () => false,
  ttl: async () => -2,
  keys: async () => [],
  flush: async () => {},
  quit: async () => {},
  healthCheck: async () => true,
  isConnected: () => true,
  getConnectionStatus: () => 'ready',
  getReconnectAttempts: () => 0,
  hget: async () => null,
  hset: async () => {},
  setex: async () => {},
  getClient: () => ({
    host: 'localhost',
    port: 6379,
    password: '',
    db: 0,
  }),
};

export const encryptionService = new EncryptionServiceImpl({
  algorithm: Config.encryption.algorithm,
  key: Config.encryption.key,
  iv: Config.encryption.iv,
});
