import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller';

const router = Router();

// Public route for website forms
router.post('/', ContactController.createMessage);

// Admin route
router.get('/', ContactController.getAllMessages);

export const contactRoutes = router;
