import { Router } from 'express';
import { referralController } from '@/controllers/referral.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const referralRoutes = Router();

// Protected — mentor must be authenticated
referralRoutes.get('/my-code', authenticateToken, referralController.getMyCode);
referralRoutes.get('/stats', authenticateToken, referralController.getStats);

// Public — used during signup to validate a referral code
referralRoutes.get('/lookup/:code', referralController.lookupCode);

export default referralRoutes;
