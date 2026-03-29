import { Router } from 'express';
import { adminNotImplemented } from '../handlers/notImplemented';

/** Mentee / support reports queue (ADMIN_PORTAL_SPECIFICATION.md Part D.10). */
const router = Router();

router.get('/', adminNotImplemented);
router.patch('/:id', adminNotImplemented);

export default router;
