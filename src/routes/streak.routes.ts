import { Router } from 'express';
import { StreakController } from '../controllers/streak.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const streakController = new StreakController();
const router = Router();

router.use(authenticateToken);

// The reading streak is free for everyone (since 2026-11-25); monthly reports stay Basic
router.post('/increment', streakController.incrementStreak);
router.get('/', streakController.getStreakData);
router.get('/monthly/:year/:month', streakController.getMonthlyStreakData);

// Reset weekly streak data (admin function)
router.post('/reset-weekly', streakController.resetWeeklyStreakData);

export { router as streakRoutes };
