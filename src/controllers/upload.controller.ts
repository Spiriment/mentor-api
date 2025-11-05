import { Request, Response, NextFunction } from 'express';
import { Logger } from '../common';
import { getFileUrl } from '../middleware/upload.middleware';

export class UploadController {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      service: 'upload-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  // Upload profile image
  uploadProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No profile image file provided',
            code: 'NO_FILE_PROVIDED',
          },
        });
      }

      const fileUrl = getFileUrl(req, req.file.filename, 'profileImage');

      this.logger.info('Profile image uploaded successfully', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
      });

      res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: fileUrl,
        },
        message: 'Profile image uploaded successfully',
      });
    } catch (error) {
      this.logger.error('Error uploading profile image', error instanceof Error ? error : new Error(String(error)));
      next(error);
    }
  };

  // Upload video introduction
  uploadVideoIntroduction = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No video introduction file provided',
            code: 'NO_FILE_PROVIDED',
          },
        });
      }

      const fileUrl = getFileUrl(req, req.file.filename, 'videoIntroduction');

      this.logger.info('Video introduction uploaded successfully', {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: fileUrl,
      });

      res.json({
        success: true,
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: fileUrl,
        },
        message: 'Video introduction uploaded successfully',
      });
    } catch (error) {
      this.logger.error('Error uploading video introduction', error instanceof Error ? error : new Error(String(error)));
      next(error);
    }
  };

  // Upload both files
  uploadFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const result: any = {};

      if (files.profileImage && files.profileImage[0]) {
        const profileImage = files.profileImage[0];
        result.profileImage = {
          filename: profileImage.filename,
          originalName: profileImage.originalname,
          size: profileImage.size,
          mimetype: profileImage.mimetype,
          url: getFileUrl(req, profileImage.filename, 'profileImage'),
        };
      }

      if (files.videoIntroduction && files.videoIntroduction[0]) {
        const videoIntroduction = files.videoIntroduction[0];
        result.videoIntroduction = {
          filename: videoIntroduction.filename,
          originalName: videoIntroduction.originalname,
          size: videoIntroduction.size,
          mimetype: videoIntroduction.mimetype,
          url: getFileUrl(req, videoIntroduction.filename, 'videoIntroduction'),
        };
      }

      this.logger.info('Files uploaded successfully', result);

      res.json({
        success: true,
        data: result,
        message: 'Files uploaded successfully',
      });
    } catch (error) {
      this.logger.error('Error uploading files', error instanceof Error ? error : new Error(String(error)));
      next(error);
    }
  };

  // Serve uploaded files
  serveFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, filename } = req.params;

      if (!['profile-images', 'video-introductions'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid file type',
            code: 'INVALID_FILE_TYPE',
          },
        });
      }

      const filePath = require('path').join(
        process.cwd(),
        'uploads',
        type,
        filename
      );

      res.sendFile(filePath, (err) => {
        if (err) {
          this.logger.error('Error serving file', err instanceof Error ? err : new Error(String(err)));
          res.status(404).json({
            success: false,
            error: {
              message: 'File not found',
              code: 'FILE_NOT_FOUND',
            },
          });
        }
      });
    } catch (error) {
      this.logger.error('Error serving file', error instanceof Error ? error : new Error(String(error)));
      next(error);
    }
  };
}
