import { Router } from 'express';
import { logger, jwt } from '../config/int-services';
import path from 'path';
import { QueueBoard, QueueManager } from '../queue';
import { QueueService } from '../core/queue.service';
import { AppDataSource } from '../config/data-source';
import { EmailService } from '../core/email.service';
import { createAuthRoutes } from './auth.routes';
import { menteeProfileRoutes } from './menteeProfile.routes';
import { mentorProfileRoutes } from './mentorProfile.routes';
import { mentorsRoutes } from './mentors.routes';
import { uploadRoutes } from './upload.routes';
import { streakRoutes } from './streak.routes';
import { sessionRoutes } from './session.routes';
import { bibleRoutes } from './bible.routes';
import { bibleUserRoutes } from './bibleUser.routes';
import studyRoutes from '@/controllers/study.controller';
import chatRoutes from '@/routes/chat.routes';
import { SystemConfigService } from '@/core/systemConfig.service';
import { Config } from '@/config';
import { EncryptionServiceImpl } from '@/common';

let queueManager: QueueManager | null = null;
let queueService: QueueService | null = null;
let emailService: EmailService | null = null;
let systemConfigService: SystemConfigService | null = null;
let encryptService: EncryptionServiceImpl | null = null;

const initializeServices = () => {
  if (!emailService) {
    // For mentor app, we don't need queue services - create email service directly
    emailService = new EmailService(null); // Pass null for queueService
    encryptService = new EncryptionServiceImpl(Config.encryption);

    logger.info('Mentor app services initialized (no queue system)');
  }
  return {
    queueManager: null,
    queueService: null,
    emailService,
    systemConfigService: null,
    encryptService,
  };
};

const getQueueBoard = () => {
  const services = initializeServices();
  return QueueBoard.getInstance(services.queueManager!);
};

const createRootRoutes = () => {
  const rootRouter = Router();

  rootRouter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: process.env.SERVICE_NAME,
      version: process.env.SERVICE_VERSION,
    });
  });

  rootRouter.use('/api/auth', (req, res, next) => {
    const services = initializeServices();
    if (!services.encryptService) {
      throw new Error('Encryption service not initialized');
    }
    if (!services.emailService) {
      throw new Error('Email service not initialized');
    }
    const authRoutes = createAuthRoutes(
      jwt,
      services.encryptService,
      null,
      AppDataSource,
      services.emailService
    );
    authRoutes(req, res, next);
  });

  // Mentee profile routes
  rootRouter.use('/api/mentee-profiles', menteeProfileRoutes);

  // Mentor profile routes
  rootRouter.use('/api/mentor-profiles', mentorProfileRoutes);

  // Mentors routes (for mentees to browse)
  rootRouter.use('/api/mentors', mentorsRoutes);

  // Upload routes
  rootRouter.use('/api/upload', uploadRoutes);

  // Streak routes
  rootRouter.use('/api/auth/streak', streakRoutes);

  // Session routes
  rootRouter.use('/api/sessions', sessionRoutes);

  // Bible routes
  rootRouter.use('/api/bible', bibleRoutes);
  rootRouter.use('/api/bible/user', bibleUserRoutes);

  // Study routes
  rootRouter.use('/api/study', studyRoutes);

  // Chat routes
  rootRouter.use('/api/chat', chatRoutes);

  // Serve uploaded files statically
  rootRouter.use('/uploads', (req, res, next) => {
    const uploadsPath = path.join(process.cwd(), 'uploads');
    require('express').static(uploadsPath)(req, res, next);
  });

  rootRouter.use('/bullboard', (req, res, next) => {
    const board = getQueueBoard();
    board.getRouter()(req, res, next);
  });

  rootRouter.get('/*', (req, res) => {
    res.json({
      status: 'error',
      message: 'Route not found',
    });
  });

  return rootRouter;
};

export { createRootRoutes };
