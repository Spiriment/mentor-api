import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import {
  uploadProfileImage,
  uploadVideoIntroduction,
  uploadFiles,
  handleUploadError,
} from '../middleware/upload.middleware';

const router = Router();
const uploadController = new UploadController();

// Upload profile image
router.post(
  '/profile-image',
  uploadProfileImage,
  handleUploadError,
  uploadController.uploadProfileImage
);

// Upload video introduction
router.post(
  '/video-introduction',
  uploadVideoIntroduction,
  handleUploadError,
  uploadController.uploadVideoIntroduction
);

// Upload both files
router.post(
  '/files',
  uploadFiles,
  handleUploadError,
  uploadController.uploadFiles
);

// Serve uploaded files
router.get('/:type/:filename', uploadController.serveFile);

export { router as uploadRoutes };
