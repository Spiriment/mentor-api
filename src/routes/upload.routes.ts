import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  uploadProfileImage,
  uploadVideoIntroduction,
  uploadFiles,
  uploadChatAttachment,
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

// Signed params for uploading a video introduction directly to Cloudinary
router.get(
  '/video-introduction/signature',
  authenticateToken,
  uploadController.getVideoUploadSignature
);

// Upload both files
router.post(
  '/files',
  uploadFiles,
  handleUploadError,
  uploadController.uploadFiles
);

// Upload chat attachment
router.post(
  '/attachment',
  uploadChatAttachment,
  handleUploadError,
  uploadController.uploadChatAttachment
);

// Serve uploaded files
router.get('/:type/:filename', uploadController.serveFile);

export { router as uploadRoutes };
