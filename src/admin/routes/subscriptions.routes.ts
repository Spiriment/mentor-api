import { Router } from 'express';
import { adminSubscriptionController } from '@/controllers/adminSubscription.controller';

const router = Router();

router.get('/summary', adminSubscriptionController.getSummary);

export default router;
