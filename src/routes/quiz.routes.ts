import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getBooks, getQuestions, submitAttempt, getAttemptHistory, getQuizStreak } from '@/controllers/quiz.controller';

const router = Router();

router.get('/books', getBooks);
router.get('/books/:book/questions', getQuestions);

router.use(authenticateToken);
router.post('/attempt', submitAttempt);
router.get('/attempts', getAttemptHistory);
router.get('/streak', getQuizStreak);

export default router;
