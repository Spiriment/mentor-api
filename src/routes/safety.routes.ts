import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.middleware';
import { validate } from '@/common/middleware/validation';
import { reportBodySchema, blockParamsSchema } from '@/validation/safety.validation';
import { createReport, listBlocks, blockStatus, blockUser, unblockUser } from '@/controllers/safety.controller';

/** Report & block (App Store guideline 1.2). Base path: /api/safety */
const router = Router();

const reportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const blockLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.use(authenticateToken);

router.post('/reports', reportLimiter, validate(reportBodySchema, 'body'), createReport);
router.get('/blocks', listBlocks);
router.get('/blocks/:userId', validate(blockParamsSchema, 'params'), blockStatus);
router.post('/blocks/:userId', blockLimiter, validate(blockParamsSchema, 'params'), blockUser);
router.delete('/blocks/:userId', blockLimiter, validate(blockParamsSchema, 'params'), unblockUser);

export default router;
