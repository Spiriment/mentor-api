import { Router } from 'express';
import { validate } from '@/common';
import { adminProfileController } from '@/controllers/adminProfile.controller';
import { adminProfilePatchBodySchema } from '@/validation/adminProfile.validation';

const router = Router();

router.get('/', adminProfileController.getMe);
router.patch(
  '/',
  validate(adminProfilePatchBodySchema, 'body'),
  adminProfileController.patchMe
);

export default router;
