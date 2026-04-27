import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { EmailService } from '@/core/email.service';

import { ChurchPortalAuthService } from './services/churchPortalAuth.service';
import { ChurchPortalDashboardService } from './services/churchPortalDashboard.service';
import { ChurchPortalMembersService } from './services/churchPortalMembers.service';
import { ChurchPortalActivityService } from './services/churchPortalActivity.service';

import { ChurchPortalAuthController } from './controllers/churchPortalAuth.controller';
import { ChurchPortalDashboardController } from './controllers/churchPortalDashboard.controller';
import { ChurchPortalMembersController } from './controllers/churchPortalMembers.controller';
import { ChurchPortalActivityController } from './controllers/churchPortalActivity.controller';

import { createChurchPortalAuthRoutes } from './routes/auth.routes';
import { createChurchPortalPortalRoutes } from './routes/portal.routes';
import { createChurchPortalDashboardRoutes } from './routes/dashboard.routes';
import { createChurchPortalMembersRoutes } from './routes/members.routes';
import { createChurchPortalActivityRoutes } from './routes/activity.routes';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests' },
});

export function createChurchPortalRouter(emailService: EmailService): Router {
  const router = Router();

  // Services
  const authService = new ChurchPortalAuthService(emailService);
  const dashboardService = new ChurchPortalDashboardService();
  const membersService = new ChurchPortalMembersService();
  const activityService = new ChurchPortalActivityService();

  // Controllers
  const authController = new ChurchPortalAuthController(authService);
  const dashboardController = new ChurchPortalDashboardController(dashboardService);
  const membersController = new ChurchPortalMembersController(membersService);
  const activityController = new ChurchPortalActivityController(activityService);

  // Routes
  router.use('/portal', createChurchPortalPortalRoutes(authController));
  router.use('/auth', authLimiter, createChurchPortalAuthRoutes(authController));
  router.use('/dashboard', apiLimiter, createChurchPortalDashboardRoutes(dashboardController));
  router.use('/members', apiLimiter, createChurchPortalMembersRoutes(membersController));
  router.use('/activity', apiLimiter, createChurchPortalActivityRoutes(activityController));

  return router;
}
