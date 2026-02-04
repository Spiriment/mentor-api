import { Router } from 'express';
import { AgoraController } from '../controllers/agora.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const agoraController = new AgoraController();
const router = Router();

// All Agora routes require authentication
router.use(authenticateToken);

// Generate Agora token for a session
router.post('/token', agoraController.generateToken);

// Log call outcome
router.post('/log-call', agoraController.logCallOutcome);

export { router as agoraRoutes };

