import { Router } from 'express';
import { MonthlySummaryController } from '../controllers/monthlySummary.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const monthlySummaryController = new MonthlySummaryController();
const router = Router();

// All report routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/reports/monthly/:year/:month
 * @desc Get monthly summary for a user
 * @access Private
 */
router.get('/:year/:month', monthlySummaryController.getMonthlySummary);

/**
 * @route POST /api/reports/monthly/generate/:year/:month
 * @desc Manually trigger summary generation
 * @access Private (Should be admin, but for now authenticated is enough for testing)
 */
router.post('/generate/:year/:month', monthlySummaryController.generateSummary);

export { router as monthlySummaryRoutes };
