import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../config/data-source';
import { MentorProfile } from '../database/entities/mentorProfile.entity';
import { User } from '../database/entities/user.entity';
import { Logger } from '../common';

export class MentorsController {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      service: 'mentors-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  // Get all approved mentors for mentees to browse
  getApprovedMentors = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const mentorProfileRepository =
        AppDataSource.getRepository(MentorProfile);
      const userRepository = AppDataSource.getRepository(User);

      // Build query for approved mentors
      let query = mentorProfileRepository
        .createQueryBuilder('profile')
        .leftJoinAndSelect('profile.user', 'user')
        .where('profile.isApproved = :isApproved', { isApproved: true })
        .andWhere('profile.isOnboardingComplete = :isComplete', {
          isComplete: true,
        });

      // Add search functionality
      if (search) {
        query = query.andWhere(
          '(user.firstName LIKE :search OR user.lastName LIKE :search OR profile.churchAffiliation LIKE :search OR profile.leadershipRoles LIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Get total count
      const totalCount = await query.getCount();

      // Get mentors with pagination
      const mentors = await query
        .orderBy('profile.approvedAt', 'DESC')
        .skip(offset)
        .take(limitNum)
        .getMany();

      // Format response data
      const formattedMentors = mentors.map((mentor) => ({
        id: mentor.id,
        userId: mentor.userId,
        firstName: mentor.user.firstName,
        lastName: mentor.user.lastName,
        profileImage: mentor.profileImage,
        christianExperience: mentor.christianExperience,
        churchAffiliation: mentor.churchAffiliation,
        leadershipRoles: mentor.leadershipRoles,
        menteeCapacity: mentor.menteeCapacity,
        mentorshipFormat: mentor.mentorshipFormat,
        menteeCalling: mentor.menteeCalling,
        videoIntroduction: mentor.videoIntroduction,
        approvedAt: mentor.approvedAt,
        // Include a brief bio for display
        bio: mentor.christianJourney
          ? mentor.christianJourney.substring(0, 150) + '...'
          : '',
      }));

      res.json({
        success: true,
        data: {
          mentors: formattedMentors,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            pages: Math.ceil(totalCount / limitNum),
          },
        },
        message: 'Approved mentors retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting approved mentors', error);
      next(error);
    }
  };

  // Get a specific mentor's full profile
  getMentorProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { mentorId } = req.params;
      const { requireApproval } = req.query;
      const skipApprovalCheck = requireApproval === 'false';

      const mentorProfileRepository =
        AppDataSource.getRepository(MentorProfile);

      // Build query - try profile.id first, then userId as fallback
      let query = mentorProfileRepository
        .createQueryBuilder('profile')
        .leftJoinAndSelect('profile.user', 'user')
        .where('(profile.id = :mentorId OR profile.userId = :mentorId)', { mentorId });

      // Only require approval if not explicitly skipped
      if (!skipApprovalCheck) {
        query = query.andWhere('profile.isApproved = :isApproved', { isApproved: true });
      }

      const mentor = await query.getOne();

      if (!mentor) {
        return res.status(404).json({
          success: false,
          error: {
            message: skipApprovalCheck 
              ? 'Mentor not found' 
              : 'Mentor not found or not approved',
            code: 'MENTOR_NOT_FOUND',
          },
        });
      }

      // Format full profile data
      const formattedMentor = {
        id: mentor.id,
        userId: mentor.userId,
        firstName: mentor.user.firstName,
        lastName: mentor.user.lastName,
        email: mentor.user.email,
        profileImage: mentor.profileImage,
        christianExperience: mentor.christianExperience,
        christianJourney: mentor.christianJourney,
        scriptureTeaching: mentor.scriptureTeaching,
        currentMentoring: mentor.currentMentoring,
        churchAffiliation: mentor.churchAffiliation,
        leadershipRoles: mentor.leadershipRoles,
        maturityDefinition: mentor.maturityDefinition,
        menteeCapacity: mentor.menteeCapacity,
        mentorshipFormat: mentor.mentorshipFormat,
        menteeCalling: mentor.menteeCalling,
        videoIntroduction: mentor.videoIntroduction,
        approvedAt: mentor.approvedAt,
        approvalNotes: mentor.approvalNotes,
      };

      res.json({
        success: true,
        data: formattedMentor,
        message: 'Mentor profile retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentor profile', error);
      next(error);
    }
  };

  // Get mentors by specific criteria
  getMentorsByCriteria = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        leadershipRoles,
        menteeCalling,
        mentorshipFormat,
        experience,
        page = 1,
        limit = 10,
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const mentorProfileRepository =
        AppDataSource.getRepository(MentorProfile);

      let query = mentorProfileRepository
        .createQueryBuilder('profile')
        .leftJoinAndSelect('profile.user', 'user')
        .where('profile.isApproved = :isApproved', { isApproved: true })
        .andWhere('profile.isOnboardingComplete = :isComplete', {
          isComplete: true,
        });

      // Add filters
      if (leadershipRoles) {
        query = query.andWhere('profile.leadershipRoles = :leadershipRoles', {
          leadershipRoles,
        });
      }

      if (menteeCalling) {
        query = query.andWhere(
          'JSON_CONTAINS(profile.menteeCalling, :menteeCalling)',
          {
            menteeCalling: JSON.stringify(menteeCalling),
          }
        );
      }

      if (mentorshipFormat) {
        query = query.andWhere(
          'JSON_CONTAINS(profile.mentorshipFormat, :mentorshipFormat)',
          {
            mentorshipFormat: JSON.stringify(mentorshipFormat),
          }
        );
      }

      if (experience) {
        query = query.andWhere('profile.christianExperience = :experience', {
          experience,
        });
      }

      const totalCount = await query.getCount();

      const mentors = await query
        .orderBy('profile.approvedAt', 'DESC')
        .skip(offset)
        .take(limitNum)
        .getMany();

      const formattedMentors = mentors.map((mentor) => ({
        id: mentor.id,
        userId: mentor.userId,
        firstName: mentor.user.firstName,
        lastName: mentor.user.lastName,
        profileImage: mentor.profileImage,
        christianExperience: mentor.christianExperience,
        churchAffiliation: mentor.churchAffiliation,
        leadershipRoles: mentor.leadershipRoles,
        menteeCapacity: mentor.menteeCapacity,
        mentorshipFormat: mentor.mentorshipFormat,
        menteeCalling: mentor.menteeCalling,
        bio: mentor.christianJourney
          ? mentor.christianJourney.substring(0, 150) + '...'
          : '',
      }));

      res.json({
        success: true,
        data: {
          mentors: formattedMentors,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            pages: Math.ceil(totalCount / limitNum),
          },
          filters: {
            leadershipRoles,
            menteeCalling,
            mentorshipFormat,
            experience,
          },
        },
        message: 'Filtered mentors retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentors by criteria', error);
      next(error);
    }
  };

  // Get recommended mentors for HomeScreen
  getRecommendedMentors = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { limit = 3 } = req.query;
      const limitNum = Math.min(parseInt(limit as string), 10); // Max 10 mentors

      const mentorProfileRepository =
        AppDataSource.getRepository(MentorProfile);
      const userRepository = AppDataSource.getRepository(User);

      // Get approved mentors with user data, ordered by approval date (newest first)
      const mentors = await mentorProfileRepository
        .createQueryBuilder('profile')
        .leftJoinAndSelect('profile.user', 'user')
        .where('profile.isApproved = :isApproved', { isApproved: true })
        .andWhere('profile.isOnboardingComplete = :isComplete', {
          isComplete: true,
        })
        .orderBy('profile.approvedAt', 'DESC')
        .limit(limitNum)
        .getMany();

      // Transform the data to match frontend expectations
      const recommendedMentors = mentors.map((mentor) => ({
        id: mentor.id,
        userId: mentor.userId,
        firstName: mentor.user?.firstName,
        lastName: mentor.user?.lastName,
        email: mentor.user?.email,
        profileImage: mentor.profileImage,
        bio: mentor.christianExperience,
        christianExperience: mentor.christianExperience,
        churchAffiliation: mentor.churchAffiliation,
        leadershipRoles: mentor.leadershipRoles,
        menteeCapacity: mentor.menteeCapacity,
        mentorshipFormat: mentor.mentorshipFormat,
        menteeCalling: mentor.menteeCalling,
        videoIntroduction: mentor.videoIntroduction,
        approvedAt: mentor.approvedAt,
      }));

      res.json({
        success: true,
        data: {
          mentors: recommendedMentors,
          total: recommendedMentors.length,
        },
        message: 'Recommended mentors retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting recommended mentors', error);
      next(error);
    }
  };
}
