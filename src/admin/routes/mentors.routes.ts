import { Router } from 'express';
import { validate } from '@/common';
import { adminMentorController } from '@/controllers/adminMentor.controller';
import {
  adminMentorListQuerySchema,
  adminMentorStatusBodySchema,
  adminMentorMessageBodySchema,
} from '@/validation/adminMentors.validation';

const router = Router();

router.get(
  '/',
  validate(adminMentorListQuerySchema, 'query'),
  adminMentorController.list
);
router.get('/:userId', adminMentorController.getById);
router.patch(
  '/:userId/status',
  validate(adminMentorStatusBodySchema, 'body'),
  adminMentorController.patchStatus
);
router.post(
  '/:userId/messages',
  validate(adminMentorMessageBodySchema, 'body'),
  adminMentorController.postMessage
);

export default router;
