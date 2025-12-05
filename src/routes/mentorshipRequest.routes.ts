import express from 'express';
import { MentorshipRequestController } from '../controllers/mentorshipRequest.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();
const controller = new MentorshipRequestController();

// All mentorship request routes require authentication
router.use(authenticateToken);

// POST /api/mentorship-requests - Create a mentorship request
router.post('/', controller.createRequest);

// GET /api/mentorship-requests - Get all mentorship requests for the authenticated user
router.get('/', controller.getRequests);

// GET /api/mentorship-requests/status/:mentorId - Get request status with specific mentor
router.get('/status/:mentorId', controller.getRequestStatus);

// GET /api/mentorship-requests/check/:mentorId - Check if has active mentorship
router.get('/check/:mentorId', controller.checkActiveMentorship);

// POST /api/mentorship-requests/:requestId/accept - Accept a mentorship request
router.post('/:requestId/accept', controller.acceptRequest);

// POST /api/mentorship-requests/:requestId/decline - Decline a mentorship request
router.post('/:requestId/decline', controller.declineRequest);

// POST /api/mentorship-requests/:requestId/cancel - Cancel a mentorship request
router.post('/:requestId/cancel', controller.cancelRequest);

export default router;
