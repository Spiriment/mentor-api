import { Request, Response, NextFunction } from 'express';
import { MentorService } from '../services/mentor.service';
import { MentorProfileService } from '../services/mentorProfile.service';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';
import { getFileUrl } from '../middleware/upload.middleware';

export class MentorController {
  private mentorService: MentorService;
  private mentorProfileService: MentorProfileService;
  private logger: Logger;

  constructor() {
    this.mentorService = new MentorService();
    this.mentorProfileService = new MentorProfileService();
    this.logger = new Logger({
      service: 'mentor-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Get mentor dashboard data
   * GET /api/mentor/dashboard
   */
  getDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not authenticated',
          StatusCodes.UNAUTHORIZED
        );
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can access dashboard',
          StatusCodes.FORBIDDEN
        );
      }

      const dashboardData = await this.mentorService.getDashboard(user.id);

      this.logger.info('Dashboard data retrieved successfully', {
        mentorId: user.id,
      });

      return sendSuccessResponse(res, {
        ...dashboardData,
        message: 'Dashboard data retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentor dashboard', error);
      next(error);
    }
  };

  /**
   * Get mentees list for a mentor
   * GET /api/mentor/mentees
   */
  getMentees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not authenticated',
          StatusCodes.UNAUTHORIZED
        );
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can access mentees list',
          StatusCodes.FORBIDDEN
        );
      }

      const { page, limit, search } = req.query;

      const result = await this.mentorService.getMentees(user.id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
      });

      this.logger.info('Mentees list retrieved successfully', {
        mentorId: user.id,
        count: result.mentees.length,
      });

      return sendSuccessResponse(res, {
        ...result,
        message: 'Mentees retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentees', error);
      next(error);
    }
  };

  /**
   * Get a specific mentee's details
   * GET /api/mentor/mentees/:menteeId
   */
  getMenteeDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not authenticated',
          StatusCodes.UNAUTHORIZED
        );
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can access mentee details',
          StatusCodes.FORBIDDEN
        );
      }

      const { menteeId } = req.params;

      const menteeDetails = await this.mentorService.getMenteeDetails(
        user.id,
        menteeId
      );

      this.logger.info('Mentee details retrieved successfully', {
        mentorId: user.id,
        menteeId,
      });

      return sendSuccessResponse(res, {
        mentee: menteeDetails,
        message: 'Mentee details retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentee details', error);
      next(error);
    }
  };

  /**
   * Update mentor profile
   * PUT /api/mentor/profile
   */
  updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not authenticated',
          StatusCodes.UNAUTHORIZED
        );
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can update profile',
          StatusCodes.FORBIDDEN
        );
      }

      const updatedProfile = await this.mentorProfileService.updateProfile(
        user.id,
        req.body
      );

      // Reload profile with user relation
      const profile = await this.mentorProfileService.getProfile(user.id);

      this.logger.info('Mentor profile updated successfully', {
        mentorId: user.id,
      });

      return sendSuccessResponse(res, {
        profile,
        message: 'Profile updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating mentor profile', error);
      next(error);
    }
  };

  /**
   * Update mentor profile photo
   * PUT /api/mentor/profile/photo
   * Handles file upload and profile update in one request
   */
  updateProfilePhoto = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not authenticated',
          StatusCodes.UNAUTHORIZED
        );
      }

      if (user.role !== 'mentor') {
        throw new AppError(
          'Only mentors can update profile photo',
          StatusCodes.FORBIDDEN
        );
      }

      // Check if file was uploaded
      if (!req.file) {
        throw new AppError(
          'No profile image file provided',
          StatusCodes.BAD_REQUEST
        );
      }

      const fileUrl = getFileUrl(req, req.file.filename, 'profileImage');

      // Update profile with new image URL
      const updatedProfile = await this.mentorProfileService.updateProfile(
        user.id,
        { profileImage: fileUrl }
      );

      // Reload profile with user relation
      const profile = await this.mentorProfileService.getProfile(user.id);

      this.logger.info('Mentor profile photo updated successfully', {
        mentorId: user.id,
        filename: req.file.filename,
      });

      return sendSuccessResponse(res, {
        profile,
        imageUrl: fileUrl,
        message: 'Profile photo updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating mentor profile photo', error);
      next(error);
    }
  };
}

