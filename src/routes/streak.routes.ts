import { Router } from 'express';
import { StreakController } from '../controllers/streak.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const streakController = new StreakController();
const router = Router();

// All streak routes require authentication
router.use(authenticateToken);

// Increment streak (called when user reads Bible)
router.post('/increment', streakController.incrementStreak);

// Get streak data
router.get('/', streakController.getStreakData);

// Get monthly streak data
router.get('/monthly/:year/:month', streakController.getMonthlyStreakData);

// Reset weekly streak data (admin function)
router.post('/reset-weekly', streakController.resetWeeklyStreakData);

export { router as streakRoutes };
