import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/requireSubscription.middleware';
import { getBooks, getQuestions, submitAttempt, getAttemptHistory, getQuizStreak, upsertQuizAchievements, submitFeedback, getLeaderboard, getProficiency, getProficiencyLevels } from '@/controllers/quiz.controller';

const router = Router();

router.get('/books', getBooks);

router.use(authenticateToken);

router.get('/books/:book/questions', requireSubscription('basic'), getQuestions);
router.post('/attempt', requireSubscription('basic'), submitAttempt);
router.post('/feedback', requireSubscription('basic'), submitFeedback);
router.get('/attempts', requireSubscription('basic'), getAttemptHistory);
router.get('/streak', requireSubscription('basic'), getQuizStreak);
router.put('/achievements', requireSubscription('basic'), upsertQuizAchievements);
router.get('/leaderboard', requireSubscription('basic'), getLeaderboard);
router.get('/proficiency', requireSubscription('basic'), getProficiency);
router.get('/proficiency/levels', requireSubscription('basic'), getProficiencyLevels);

export default router;
