import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthService } from '@/services/auth.service';
import {
  AppError,
  Logger,
  JwtService,
  AuthenticatedRequest,
  EncryptionServiceImpl,
  RedisClient,
  UserPayload,
} from '@/common';
import { EmailService } from '@/core/email.service';
import { UserService } from '@/services/user.service';
import { UserRepository } from '@/repository/user.repository';
import { DataSource } from 'typeorm';
import { User } from '@/database/entities';
import { sendSuccessResponse } from '@/common/helpers';

export class AuthController {
  private logger: Logger;
  private authService: AuthService;
  private jwtService: JwtService;
  private encryptService: EncryptionServiceImpl;
  private UserService: UserService;
  private userRepository: UserRepository;

  constructor(
    dataSource: DataSource,
    redis: RedisClient | null,
    encryptService: EncryptionServiceImpl,
    jwtService: JwtService,
    emailService: EmailService,
    userRepository: UserRepository
  ) {
    this.logger = new Logger({
      level: process.env.LOG_LEVEL as any,
      service: 'auth-controller',
    });
    this.encryptService = encryptService;
    this.jwtService = jwtService;
    this.userRepository = userRepository;
    this.UserService = new UserService(dataSource, redis, encryptService);
    this.authService = new AuthService(
      this.jwtService,
      this.encryptService,
      emailService,
      redis,
      userRepository
    );
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.body);
      this.logger.info('User registration initiated successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.login(req.body);
      this.logger.info('User logged in successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, tokens);
    } catch (error) {
      next(error);
    }
  };

  // New OTP-based login endpoints
  sendLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.sendLoginOtp(req.body);
      this.logger.info('Login OTP sent successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  verifyLoginOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.verifyLoginOtp(req.body);
      this.logger.info('Login OTP verified successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, tokens);
    } catch (error) {
      next(error);
    }
  };

  googleSignIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.googleSignIn(req.body);
      this.logger.info('Google Sign-In successful', {
        email: req.body.email || 'unknown',
      });
      return sendSuccessResponse(res, tokens);
    } catch (error) {
      next(error);
    }
  };

  sendVerificationEmail = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      await this.authService.resendVerificationEmail(req.body);
      this.logger.info('Verification email resent successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, {
        message: 'Verification email sent. Please check your email.',
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.verifyEmail(req.body);
      this.logger.info('Email verified successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, tokens);
    } catch (error) {
      next(error);
    }
  };

  // Profile update methods
  updateBasicInfo = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await this.authService.updateBasicInfo(
        req.user.id,
        req.body
      );
      this.logger.info('User basic info updated successfully', {
        userId: req.user.id,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  updateAddress = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await this.authService.updateAddress(
        req.user.id,
        req.body
      );
      this.logger.info('User address updated successfully', {
        userId: req.user.id,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }

      const profile = await this.authService.getProfile(req.user.id);
      this.logger.info('User profile retrieved successfully', {
        userId: req.user.id,
      });
      return sendSuccessResponse(res, profile);
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokens = await this.authService.refreshToken(req.body.refreshToken);
      this.logger.info('Token refreshed successfully');
      return sendSuccessResponse(res, tokens);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.logout(req.body.refreshToken);
      this.logger.info('User logged out successfully');
      return sendSuccessResponse(res, null);
    } catch (error) {
      next(error);
    }
  };

  getUserUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        throw new AppError('User not authenticated', 401);
      }
      const User = await this.UserService.getUserById(req.user.id);

      this.logger.info('User from request');
      return sendSuccessResponse(res, User);
    } catch (error) {
      next(error);
    }
  };

  verifyToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = req.headers.authorization?.split(' ')[1];
    this.logger.debug('Auth headers:', {
      authorization: req.headers.authorization,
      token,
    });

    if (token) {
      try {
        const decoded = this.jwtService.verify<UserPayload>(token);
        this.logger.info('Token verification result:', { decoded });
        req.user = decoded as unknown as User;
        next();
      } catch (error: any) {
        this.logger.error('Token verification error:', error);
        next(new AppError('Invalid token', 401));
      }
    } else {
      next(new AppError('No token provided', 401));
    }
  };

  verifyTokenEndpoint = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const User = req.user;
      if (!User) {
        throw new AppError('User not authenticated', 401);
      }
      return sendSuccessResponse(res, User);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.forgotPassword(req.body.email);
      this.logger.info('Password reset email sent successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, {
        message: 'Password reset instructions sent to your email',
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.resetPassword(req.body);
      this.logger.info('Password reset successfully');
      return sendSuccessResponse(res, {
        message: 'Password has been reset successfully',
      });
    } catch (error: any) {
      next(error);
    }
  };

  verifyResetOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.verifyResetOtp(req.body);
      return sendSuccessResponse(res, {
        message: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Mentor App specific methods
  emailRegistration = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Log incoming request details
      this.logger.info('📧 Email registration request received', {
        email: req.body.email,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
      });

      const result = await this.authService.emailRegistration(req.body);
      
      this.logger.info('✅ Email registration initiated successfully', {
        email: req.body.email,
        isExistingUser: result.isExistingUser,
        isEmailVerified: result.isEmailVerified,
      });
      
      return sendSuccessResponse(res, result);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('❌ Email registration error', errorObj, {
        email: req.body.email,
      });
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.verifyOtp(req.body);
      this.logger.info('OTP verified successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  updateUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.authService.updateUserProfile(req.body);
      this.logger.info('User profile updated successfully', {
        email: req.body.email,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  selectRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.selectRole(req.body);
      this.logger.info('Role selected successfully', {
        email: req.body.email,
        role: req.body.role,
      });
      return sendSuccessResponse(res, result);
    } catch (error) {
      next(error);
    }
  };

  // Get current user profile
  getCurrentUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not found',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND'
        );
      }

      // Get role-specific profile data
      let roleProfile = null;
      if (user.role === 'mentee') {
        const menteeProfileRepository =
          this.userRepository.manager.getRepository('MenteeProfile');
        roleProfile = await menteeProfileRepository.findOne({
          where: { userId: user.id },
          relations: ['user'],
        });
      } else if (user.role === 'mentor') {
        const mentorProfileRepository =
          this.userRepository.manager.getRepository('MentorProfile');
        roleProfile = await mentorProfileRepository.findOne({
          where: { userId: user.id },
          relations: ['user'],
        });
      }

      const profileData: any = {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          country: user.country,
          countryCode: user.countryCode,
          birthday: user.birthday,
          role: user.role,
          isOnboardingComplete: user.isOnboardingComplete,
          mentorApprovalStatus: user.mentorApprovalStatus,
          mentorApprovedAt: user.mentorApprovedAt,
          isActive: user.isActive,
          accountStatus: user.accountStatus,
          // Streak data
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          lastStreakDate: user.lastStreakDate,
          weeklyStreakData: user.weeklyStreakData,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        roleProfile: roleProfile,
      };

      // Flatten mentee-specific fields needed by the app at the top level
      if (user.role === 'mentee' && roleProfile) {
        profileData.spiritualGrowthAreas =
          roleProfile.spiritualGrowthAreas || [];
        // Add study data to profile
        profileData.profile = {
          country: roleProfile.bio || user.country,
          profileImage: roleProfile.profileImage,
          currentBook: roleProfile.currentBook,
          currentChapter: roleProfile.currentChapter,
          completedChapters: roleProfile.completedChapters,
          studyDays: roleProfile.studyDays,
          lastSessionDate: null, // TODO: Add from sessions table
        };
      }

      this.logger.info('Current user profile retrieved', {
        userId: user.id,
        role: user.role,
      });

      return sendSuccessResponse(res, profileData);
    } catch (error: any) {
      this.logger.error('Error getting current user profile', error);
      next(error);
    }
  };

  // Update streak when user reads for minimum time
  // ⚠️ DEPRECATED: This endpoint is deprecated. Use /api/auth/streak/increment instead.
  // This endpoint will be removed in a future version.
  // The new endpoint provides: timezone support, streak freezes, monthly tracking, and better date handling.
  updateStreak = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user; // Set by auth middleware

      // Log deprecation warning
      this.logger.warn('DEPRECATED: /auth/update-streak endpoint used. Migrate to /auth/streak/increment', {
        userId: user?.id,
        userAgent: req.get('user-agent'),
      });

      if (!user) {
        throw new AppError(
          'User not authenticated',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED'
        );
      }

      // Update streak in backend
      const today = new Date().toISOString().split('T')[0];
      const lastStreakDate = user.lastStreakDate
        ? new Date(user.lastStreakDate).toISOString().split('T')[0]
        : null;

      let currentStreak = user.currentStreak || 0;
      let longestStreak = user.longestStreak || 0;

      // CRITICAL: Check if user already updated streak today - prevent duplicate updates
      if (lastStreakDate === today) {
        this.logger.info('Streak already updated for today - preventing duplicate update', {
          userId: user.id,
          lastStreakDate,
          today,
          currentStreak,
        });
        
        return sendSuccessResponse(res, {
          message: 'Streak already updated for today',
          currentStreak,
          longestStreak,
          alreadyUpdated: true,
        });
      }

      // If user hasn't read today yet, increment streak
      if (lastStreakDate !== today) {
        this.logger.info('Updating streak for new day', {
          userId: user.id,
          lastStreakDate,
          today,
          currentStreak,
        });
        // Check if yesterday was consecutive
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        if (lastStreakDate === yesterday) {
          // Consecutive day - increment streak
          currentStreak += 1;
        } else if (lastStreakDate !== today) {
          // Not consecutive - reset to 1
          currentStreak = 1;
        }

        // Update longest streak if needed
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }

        // Update weekly streak data - preserve previous days
        let weeklyData: (boolean | number)[] = [];
        if (user.weeklyStreakData) {
          if (typeof user.weeklyStreakData === 'string') {
            try {
              weeklyData = JSON.parse(user.weeklyStreakData);
            } catch (e) {
              weeklyData = new Array(7).fill(false);
            }
          } else if (Array.isArray(user.weeklyStreakData)) {
            weeklyData = [...user.weeklyStreakData];
          } else {
            weeklyData = new Array(7).fill(false);
          }
        } else {
          weeklyData = new Array(7).fill(false);
        }
        
        // Ensure array has 7 elements
        while (weeklyData.length < 7) {
          weeklyData.push(false);
        }
        
        const todayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
        weeklyData[todayIndex] = true; // Mark today as read (use true for consistency)

        // Update user in database - store as JSON string for consistency
        await this.userRepository.update(user.id, {
          currentStreak,
          longestStreak,
          lastStreakDate: today,
          weeklyStreakData: weeklyData, // TypeORM will handle JSON serialization
        } as any);

        this.logger.info('Streak updated successfully', {
          userId: user.id,
          currentStreak,
          longestStreak,
        });
      } else {
        this.logger.info('Streak already updated for today', {
          userId: user.id,
          lastStreakDate,
          today,
          currentStreak,
        });
      }

      return sendSuccessResponse(res, {
        message:
          lastStreakDate !== today
            ? 'Streak updated successfully'
            : 'Streak already updated for today',
        currentStreak,
        longestStreak,
      });
    } catch (error: any) {
      this.logger.error('Error updating streak', error);
      next(error);
    }
  };

  // Update authenticated user profile
  updateAuthenticatedUserProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        throw new AppError(
          'User not found',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND'
        );
      }

      const updateData = req.body;
      const allowedFields = [
        'firstName',
        'lastName',
        'gender',
        'country',
        'countryCode',
        'birthday',
        'timezone',
        'notificationPreferences',
        'pushNotificationsEnabled',
      ];

      // Filter only allowed fields
      const filteredData = Object.keys(updateData)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {} as any);

      // Update user profile
      await this.userRepository.update(user.id, filteredData);

      // Get updated user
      const updatedUser = await this.userRepository.findOne({
        where: { id: user.id },
        select: [
          'id',
          'email',
          'firstName',
          'lastName',
          'gender',
          'country',
          'countryCode',
          'birthday',
          'role',
          'isOnboardingComplete',
          'isActive',
          'accountStatus',
          'createdAt',
          'updatedAt',
        ],
      });

      this.logger.info('User profile updated successfully', {
        userId: user.id,
        updatedFields: Object.keys(filteredData),
      });

      return sendSuccessResponse(res, {
        user: updatedUser,
        message: 'Profile updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating user profile', error);
      next(error);
    }
  };
}
