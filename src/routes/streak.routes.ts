import { Router } from 'express';
import { StreakController } from '../controllers/streak.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/requireSubscription.middleware';

const streakController = new StreakController();
const router = Router();

router.use(authenticateToken);

router.post('/increment', requireSubscription('basic'), streakController.incrementStreak);
router.get('/', requireSubscription('basic'), streakController.getStreakData);
router.get('/monthly/:year/:month', requireSubscription('basic'), streakController.getMonthlyStreakData);

// Reset weekly streak data (admin function)
router.post('/reset-weekly', streakController.resetWeeklyStreakData);

export { router as streakRoutes };
