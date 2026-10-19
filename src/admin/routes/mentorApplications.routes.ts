import { Router } from 'express';
import { videoUploadAttemptController } from '@/controllers/videoUploadAttempt.controller';
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
// Before '/:id' so it isn't captured as an application id
router.get('/video-upload-attempts', videoUploadAttemptController.adminList);
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
