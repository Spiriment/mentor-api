import { Router } from 'express';
import { validate } from '@/common';
import { adminMentorApplicationController } from '@/controllers/adminMentorApplication.controller';
import {
  mentorApplicationListQuerySchema,
  mentorApplicationNoteBodySchema,
  mentorApplicationDecisionBodySchema,
} from '@/validation/adminMentorApplications.validation';

const router = Router();

router.get(
  '/',
  validate(mentorApplicationListQuerySchema, 'query'),
  adminMentorApplicationController.list
);
router.get('/:id', adminMentorApplicationController.getById);
router.post(
  '/:id/notes',
  validate(mentorApplicationNoteBodySchema, 'body'),
  adminMentorApplicationController.appendNote
);
router.post(
  '/:id/decision',
  validate(mentorApplicationDecisionBodySchema, 'body'),
  adminMentorApplicationController.decision
);

export default router;
