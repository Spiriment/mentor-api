import { Router } from 'express';
import { StreamController } from '../controllers/stream.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const streamController = new StreamController();
const router = Router();

// All Stream routes require authentication
router.use(authenticateToken);

// Generate Stream token for a user
router.get('/token', streamController.generateToken);

// Log call outcome
router.post('/log-call', streamController.logCallOutcome);

export { router as streamRoutes };
