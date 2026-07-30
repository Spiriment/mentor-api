import { Router } from 'express';
import { validate } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { requireAdminRole } from '../middleware/requireAdminRole.middleware';
import {
  uploadBroadcastExcel,
  uploadBroadcastImage,
} from '../../middleware/upload.middleware';
import { adminBroadcastController } from '@/controllers/adminBroadcast.controller';
import {
  adminBroadcastCreateBodySchema,
  adminBroadcastListQuerySchema,
  adminBroadcastRecipientsQuerySchema,
  adminBroadcastSaveTemplateBodySchema,
  adminBroadcastScheduleBodySchema,
  adminBroadcastSendTestBodySchema,
  adminBroadcastUpdateBodySchema,
} from '@/validation/adminBroadcast.validation';

const router = Router();

router.use(requireAdminRole(ADMIN_ROLE.SUPER_ADMIN));

router.get(
  '/',
  validate(adminBroadcastListQuerySchema, 'query'),
  adminBroadcastController.list
);

router.post(
  '/',
  validate(adminBroadcastCreateBodySchema, 'body'),
  adminBroadcastController.create
);

router.post(
  '/upload-image',
  uploadBroadcastImage,
  adminBroadcastController.uploadImage
);

router.get('/:id', adminBroadcastController.getById);

router.put(
  '/:id',
  validate(adminBroadcastUpdateBodySchema, 'body'),
  adminBroadcastController.update
);

router.delete('/:id', adminBroadcastController.remove);

router.get(
  '/:id/recipients',
  validate(adminBroadcastRecipientsQuerySchema, 'query'),
  adminBroadcastController.listRecipients
);

router.post('/:id/preview-audience', adminBroadcastController.previewAudience);

router.post(
  '/:id/import-excel',
  uploadBroadcastExcel,
  adminBroadcastController.importExcel
);

router.post(
  '/:id/send-test',
  validate(adminBroadcastSendTestBodySchema, 'body'),
  adminBroadcastController.sendTest
);

router.post('/:id/send', adminBroadcastController.send);

router.post(
  '/:id/schedule',
  validate(adminBroadcastScheduleBodySchema, 'body'),
  adminBroadcastController.schedule
);

router.post('/:id/cancel', adminBroadcastController.cancel);

router.post('/:id/duplicate', adminBroadcastController.duplicate);

router.post(
  '/:id/save-as-template',
  validate(adminBroadcastSaveTemplateBodySchema, 'body'),
  adminBroadcastController.saveAsTemplate
);

export default router;
