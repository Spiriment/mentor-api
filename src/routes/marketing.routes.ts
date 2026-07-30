import { Router } from 'express';
import { MarketingController } from '@/controllers/marketing.controller';

const router = Router();

router.get('/unsubscribe', MarketingController.unsubscribe);

export default router;
