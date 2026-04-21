import { Router } from 'express';
import { FaqController } from '../controllers/faq.controller';

const router = Router();

// Public
router.get('/published', FaqController.getPublished);

// Admin
router.get('/', FaqController.getAll);
router.post('/', FaqController.create);
router.put('/:id', FaqController.update);
router.delete('/:id', FaqController.delete);

export const faqRoutes = router;
