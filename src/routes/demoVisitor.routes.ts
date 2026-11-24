import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { demoVisitorController } from '@/controllers/demoVisitor.controller';

/** Public tracking for the church portal demo. Base path: /api/demo-visitors */
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const activityLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

const router = Router();
router.post('/', signupLimiter, demoVisitorController.signup);
router.post('/:id/activity', activityLimiter, demoVisitorController.activity);

export const demoVisitorRoutes = router;
