import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireSubscription } from '../middleware/requireSubscription.middleware';
import {
  getChapterSummary,
  getReflectionPrompts,
  getReadingRecommendations,
} from '@/controllers/ai.controller';

const router = Router();

router.use(authenticateToken);
router.use(requireSubscription('pro'));

router.post('/chapter-summary', getChapterSummary);
router.post('/reflection-prompts', getReflectionPrompts);
router.post('/reading-recommendations', getReadingRecommendations);

export default router;
