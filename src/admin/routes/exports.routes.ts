import { Router } from 'express';
import { adminNotImplemented } from '../handlers/notImplemented';

const router = Router();

// Register static paths before `/:jobId`
router.post('/monthly-report', adminNotImplemented);
router.get('/:jobId', adminNotImplemented);

export default router;
