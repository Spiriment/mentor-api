import { Router } from 'express';
import { adminQuizController } from '@/controllers/adminQuiz.controller';

const router = Router();

router.get('/catalog', adminQuizController.catalog);

export default router;
