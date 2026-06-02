import { Router } from 'express';
import { handleRevenueCatWebhook } from '@/controllers/revenueCatWebhook.controller';

const router = Router();

router.post('/', handleRevenueCatWebhook);

export default router;
