import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { jwt } from '@/config/int-services';
import { adminController } from '../controllers/admin.controller';
import { adminNotImplemented } from './handlers/notImplemented';
import { adminMentorApplicationController } from '@/controllers/adminMentorApplication.controller';
import { createAdminAuthMiddleware } from './middleware/adminAuth.middleware';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import mentorApplicationsRoutes from './routes/mentorApplications.routes';
import mentorsRoutes from './routes/mentors.routes';
import usersRoutes from './routes/users.routes';
import subscriptionsRoutes from './routes/subscriptions.routes';
import plansRoutes from './routes/plans.routes';
import settingsRoutes from './routes/settings.routes';
import exportsRoutes from './routes/exports.routes';
import reportsRoutes from './routes/reports.routes';
import adminUsersRoutes from './routes/adminUsers.routes';
import profileRoutes from './routes/profile.routes';

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests to admin auth' },
  },
});

const adminProtectedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many admin API requests' },
  },
});

/**
 * Admin API — base path `/api/admin`.
 * Part D: ADMIN_PORTAL_SPECIFICATION.md
 */
export function createAdminRouter(): Router {
  const router = Router();

  router.use('/auth', adminAuthLimiter, authRoutes);

  const protectedAdmin = Router();
  protectedAdmin.use(adminProtectedLimiter);
  protectedAdmin.use(createAdminAuthMiddleware(jwt));

  protectedAdmin.use('/dashboard', dashboardRoutes);
  protectedAdmin.use('/mentor-applications', mentorApplicationsRoutes);
  protectedAdmin.use('/mentors', mentorsRoutes);
  protectedAdmin.use('/users', usersRoutes);
  protectedAdmin.use('/subscriptions', subscriptionsRoutes);
  protectedAdmin.use('/plans', plansRoutes);
  protectedAdmin.use('/settings', settingsRoutes);
  protectedAdmin.use('/exports', exportsRoutes);
  protectedAdmin.use('/reports', reportsRoutes);
  protectedAdmin.use('/admin-users', adminUsersRoutes);
  protectedAdmin.use('/profile', profileRoutes);

  protectedAdmin.get(
    '/message-templates/:templateId',
    adminMentorApplicationController.getTemplatePreview
  );
  protectedAdmin.get('/audit-log', adminNotImplemented);

  protectedAdmin.post(
    '/broadcast-push',
    adminController.broadcastPushNotification
  );

  router.use(protectedAdmin);

  return router;
}
