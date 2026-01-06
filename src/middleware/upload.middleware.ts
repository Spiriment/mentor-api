import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { Logger } from '../common';

const logger = new Logger({
  service: 'upload-middleware',
  level: process.env.LOG_LEVEL || 'info',
});

// Ensure upload directories exist
const uploadDir = path.join(process.cwd(), 'uploads');
const profileImagesDir = path.join(uploadDir, 'profile-images');
const videoIntroductionsDir = path.join(uploadDir, 'video-introductions');
const chatAttachmentsDir = path.join(uploadDir, 'chat-attachments');

[uploadDir, profileImagesDir, videoIntroductionsDir, chatAttachmentsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created upload directory: ${dir}`);
  }
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: Function) => {
    let uploadPath = uploadDir;

    if (file.fieldname === 'profileImage') {
      uploadPath = profileImagesDir;
    } else if (file.fieldname === 'videoIntroduction') {
      uploadPath = videoIntroductionsDir;
    } else if (file.fieldname === 'file') {
      uploadPath = chatAttachmentsDir;
    }

    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// File filter for validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: Function) => {
  const fieldname = file.fieldname;

  if (fieldname === 'profileImage') {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Profile image must be an image file'), false);
    }
  } else if (fieldname === 'videoIntroduction') {
    // Allow only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Video introduction must be a video file'), false);
    }
  } else if (fieldname === 'file') {
    // Allow images, audio, and video
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for chat attachment'), false);
    }
  } else {
    cb(new Error('Invalid field name'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only one file per request
  },
});

// Middleware for profile image upload
export const uploadProfileImage = upload.single('profileImage');

// Middleware for video introduction upload
export const uploadVideoIntroduction = upload.single('videoIntroduction');

// Middleware for both uploads
export const uploadFiles = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'videoIntroduction', maxCount: 1 },
]);

// Middleware for chat attachment
export const uploadChatAttachment = upload.single('file');

// Error handling middleware
export const handleUploadError = (
  error: any,
  req: Request,
  res: any,
  next: Function
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'File size too large. Maximum size is 50MB.',
          code: 'FILE_TOO_LARGE',
        },
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Too many files. Only one file per request is allowed.',
          code: 'TOO_MANY_FILES',
        },
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Unexpected file field.',
          code: 'UNEXPECTED_FILE',
        },
      });
    }
  }

  if (error.message.includes('must be an image file')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Profile image must be an image file (JPEG, PNG, etc.)',
        code: 'INVALID_IMAGE_TYPE',
      },
    });
  }

  if (error.message.includes('must be a video file')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Video introduction must be a video file (MP4, MOV, etc.)',
        code: 'INVALID_VIDEO_TYPE',
      },
    });
  }

  if (error.message.includes('Invalid file type for chat attachment')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid file type. Allowed: Image, Audio, Video',
        code: 'INVALID_ATTACHMENT_TYPE',
      },
    });
  }

  logger.error('Upload error:', error);
  next(error);
};

// Utility function to get file URL
export const getFileUrl = (
  req: Request,
  filename: string,
  fieldname: string
): string => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const uploadPath =
    fieldname === 'profileImage'
      ? 'profile-images'
      : fieldname === 'videoIntroduction'
      ? 'video-introductions'
      : 'chat-attachments';
  return `${baseUrl}/uploads/${uploadPath}/${filename}`;
};

// Utility function to delete file
export const deleteFile = (filepath: string): void => {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info(`Deleted file: ${filepath}`);
    }
  } catch (error: any) {
    logger.error(`Failed to delete file: ${filepath}`, error);
  }
};
