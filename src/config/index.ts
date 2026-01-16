import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'staging'
    ? '.env.staging'
    : process.env.NODE_ENV === 'development'
    ? '.env.development'
    : '.env';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const configSchema = z.object({
  port: z.string().transform(Number).default('3000'),
  nodeEnv: z
    .enum(['development', 'production', 'test', 'staging'])
    .default('development'),
  appUrl: z.string(),
  database: z.object({
    host: z.string().default('localhost'),
    port: z.string().transform(Number).default('5432'),
    username: z.string().default('postgres'),
    password: z.string().default('postgres'),
    name: z.string().default('notification_service'),
    ssl: z.boolean().default(false),
    synchronize: z.boolean().default(false),
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    username: z.string().default(''),
    port: z.string().transform(Number).default('6378'),
    password: z.string().default(''),
    db: z.string().transform(Number).default('1'),
  }),
  allowedOrigins: z.array(z.string()).default(['http://localhost:3000']),
  jwt: z.object({
    publicKey: z.string(),
    privateKey: z.string(),
    expiresIn: z.string().default('1d'),
  }),
  rateLimit: z.object({
    windowMs: z.string().transform(Number).default('60000'),
    max: z.string().transform(Number).default('1000'),
  }),
  encryption: z.object({
    algorithm: z.string(),
    key: z.string(),
    iv: z.string(),
  }),
  service: z.object({
    name: z.string(),
    version: z.string(),
  }),
  cors: z.object({
    origin: z.string(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
  email: z.object({
    host: z.string(),
    port: z.string().transform(Number).default('').optional(),
    user: z.string(),
    password: z.string(),
    from: z.string(),
  }),
  queue: z.object({
    settings: z.object({
      removeOnComplete: z.string().transform(Number).default('100'),
      removeOnFail: z.string().transform(Number).default('50'),
      attempts: z.string().transform(Number).default('3'),
    }),
  }),
  cloudinary: z.object({
    cloudName: z.string(),
    apiKey: z.string(),
    apiSecret: z.string(),
  }),
  agora: z.object({
    appId: z.string(),
    appCertificate: z.string().optional(),
  }),
  expo: z.object({
    accessToken: z.string().optional(),
  }),
});

const Config = configSchema.parse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  appUrl: process.env.APP_URL,
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    iv: process.env.ENCRYPTION_IV,
    algorithm: process.env.ENCRYPTION_ALGORITHM,
  },
  redis: {
    host: process.env.REDIS_HOST,
    username: process.env.REDIS_USERNAME,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB,
  },
  jwt: {
    publicKey: process.env.JWT_PUBLIC_KEY,
    privateKey: process.env.JWT_PRIVATE_KEY,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS,
    max: process.env.RATE_LIMIT_MAX_REQUESTS,
  },
  service: {
    name: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
  },
  cors: {
    origin: process.env.CORS_ORIGIN,
  },
  logging: {
    level: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  },
  queue: {
    settings: {
      removeOnComplete: process.env.QUEUE_REMOVE_ON_COMPLETE,
      removeOnFail: process.env.QUEUE_REMOVE_ON_FAIL,
      attempts: process.env.QUEUE_ATTEMPTS,
    },
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  agora: {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE,
  },
  expo: {
    accessToken: process.env.EXPO_ACCESS_TOKEN,
  },
});

// Add environment debugging
console.log(`🔧 Config loaded from: ${envFile}`);
console.log(`🏢 Environment: ${Config.nodeEnv}`);
console.log(
  `🗄️ Database: ${Config.database.host}:${Config.database.port}/${Config.database.name}`
);
console.log(`📱 Expo Access Token: ${Config.expo.accessToken ? 'Present (Starts with ' + Config.expo.accessToken.substring(0, 5) + '...)' : 'MISSING'}`);

export { Config };
