import { Router } from 'express';
import { validate } from '@/common';
import { adminMentorController } from '@/controllers/adminMentor.controller';
import { requireAdminPermission } from '@/admin/middleware/requireAdminPermission.middleware';
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
router.get('/:userId/reviews', adminMentorController.listReviews);
router.delete(
  '/:userId/reviews/:reviewId',
  requireAdminPermission('review.delete'),
  adminMentorController.deleteReview
);

export default router;
