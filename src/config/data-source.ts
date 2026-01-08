import { DataSource } from 'typeorm';
import { Config } from '../common';
import {
  RefreshToken,
  AuditLog,
  PasswordReset,
  SystemConfig,
  UserNotification,
  AppNotification,
  User,
  MenteeProfile,
  MentorProfile,
  Session,
  SessionReview,
  MentorAvailability,
  GroupSession,
  GroupSessionParticipant,
  MentorshipRequest,
  BibleBookmark,
  BibleHighlight,
  BibleReflection,
  BibleProgress,
  StudyProgress,
  StudySession,
  StudyReflection,
  Conversation,
  Message,
  ConversationParticipant,
  ScheduledNotification,
} from '@/database/entities';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: Config.database.host,
  port: Config.database.port,
  username: Config.database.username,
  password: Config.database.password,
  database: Config.database.name,
  synchronize: Config.database.synchronize,
  logging: false,
  ssl: Config.database.ssl,
  extra: {
    // Connection pool configuration
    // Development: 5 connections (single developer)
    // Production: 20 connections (handles 100-500 concurrent users)
    connectionLimit: process.env.NODE_ENV === 'production' ? 20 : 5,
    maxIdle: 10, // Maximum idle connections to keep
    idleTimeout: 60000, // 60 seconds (increased from 10 seconds for better connection reuse)
  },
  entities: [
    RefreshToken,
    AuditLog,
    PasswordReset,
    SystemConfig,
    UserNotification,
    AppNotification,
    User,
    MenteeProfile,
    MentorProfile,
    Session,
    SessionReview,
    MentorAvailability,
    GroupSession,
    GroupSessionParticipant,
    MentorshipRequest,
    BibleBookmark,
    BibleHighlight,
    BibleReflection,
    BibleProgress,
    StudyProgress,
    StudySession,
    StudyReflection,
    Conversation,
    Message,
    ConversationParticipant,
    ScheduledNotification,
  ],
  migrations: [
    process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging'
      ? 'dist/database/migrations/*.js'
      : 'src/database/migrations/*.ts',
  ],
  subscribers: [],
});
