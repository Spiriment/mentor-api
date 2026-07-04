import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/requireSubscription.middleware';
import { getBooks, getQuestions, submitAttempt, getAttemptHistory, getQuizStreak, submitFeedback, getLeaderboard } from '@/controllers/quiz.controller';

const router = Router();

router.get('/books', getBooks);

router.use(authenticateToken);

router.get('/books/:book/questions', requireSubscription('basic'), getQuestions);
router.post('/attempt', requireSubscription('basic'), submitAttempt);
router.post('/feedback', requireSubscription('basic'), submitFeedback);
router.get('/attempts', requireSubscription('basic'), getAttemptHistory);
router.get('/streak', requireSubscription('basic'), getQuizStreak);
router.get('/leaderboard', requireSubscription('basic'), getLeaderboard);

export default router;
