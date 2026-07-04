import { Router } from 'express';
import { MonthlySummaryController } from '../controllers/monthlySummary.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/requireSubscription.middleware';

const monthlySummaryController = new MonthlySummaryController();
const router = Router();

router.use(authenticateToken);

router.get('/:year/:month', requireSubscription('basic'), monthlySummaryController.getMonthlySummary);
router.post('/generate/:year/:month', requireSubscription('basic'), monthlySummaryController.generateSummary);

export { router as monthlySummaryRoutes };
