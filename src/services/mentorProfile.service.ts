import { Repository } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { MentorProfile } from '../database/entities/mentorProfile.entity';
import { User } from '../database/entities/user.entity';
import { Logger, USER_ROLE, MENTOR_APPROVAL_STATUS, AppError } from '../common';
import { pushNotificationService } from './pushNotification.service';
import { getAppNotificationService } from './appNotification.service';
import { AppNotificationType } from '../database/entities/appNotification.entity';
import { Session, SESSION_STATUS } from '../database/entities/session.entity';
import { SessionReview } from '../database/entities/sessionReview.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '../database/entities/mentorshipRequest.entity';

export class MentorProfileService {
  private mentorProfileRepository: Repository<MentorProfile>;
  private userRepository: Repository<User>;
  private sessionRepository: Repository<Session>;
  private sessionReviewRepository: Repository<SessionReview>;
  private mentorshipRequestRepository: Repository<MentorshipRequest>;
  private logger: Logger;

  constructor() {
    this.mentorProfileRepository = AppDataSource.getRepository(MentorProfile);
    this.userRepository = AppDataSource.getRepository(User);
    this.sessionRepository = AppDataSource.getRepository(Session);
    this.sessionReviewRepository = AppDataSource.getRepository(SessionReview);
    this.mentorshipRequestRepository = AppDataSource.getRepository(MentorshipRequest);
    this.logger = new Logger({
      service: 'mentor-profile-service',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  // Create or get mentor profile
  async getOrCreateProfile(userId: string): Promise<MentorProfile> {
    try {
      let profile = await this.mentorProfileRepository.findOne({
        where: { userId },
        relations: ['user'],
      });

      if (!profile) {
        // Verify user exists and has mentor role
        const user = await this.userRepository.findOne({
          where: { id: userId, role: USER_ROLE.MENTOR as any },
        });

        if (!user) {
          throw new Error('User not found or not a mentor');
        }

        // Create new profile
        profile = this.mentorProfileRepository.create({
          userId,
          onboardingStep: 'christianExperience',
        });

        profile = await this.mentorProfileRepository.save(profile);
        this.logger.info(`Created mentor profile for user ${userId}`);
      }

      return profile;
    } catch (error) {
      this.logger.error('Error getting or creating mentor profile', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Update specific onboarding step
  async updateOnboardingStep(
    userId: string,
    step: string,
    data: any
  ): Promise<MentorProfile> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Update the specific field based on step
      switch (step) {
        case 'christianExperience':
          profile.christianExperience = data.christianExperience;
          break;
        case 'christianJourney':
          profile.christianJourney = data.christianJourney;
          break;
        case 'scriptureTeaching':
          profile.scriptureTeaching = data.scriptureTeaching;
          break;
        case 'currentMentoring':
          profile.currentMentoring = data.currentMentoring;
          break;
        case 'churchAffiliation':
          profile.churchAffiliation = data.churchAffiliation;
          break;
        case 'leadershipRoles':
          profile.leadershipRoles = data.leadershipRoles;
          break;
        case 'maturityDefinition':
          profile.maturityDefinition = data.maturityDefinition;
          break;
        case 'menteeCapacity':
          profile.menteeCapacity = data.menteeCapacity;
          break;
        case 'mentorshipFormat':
          profile.mentorshipFormat = data.mentorshipFormat;
          break;
        case 'menteeCalling':
          profile.menteeCalling = data.menteeCalling;
          break;
        case 'videoIntroduction':
          profile.videoIntroduction = data.videoIntroduction;
          break;
        case 'profileImage':
          profile.profileImage = data.profileImage;
          break;
        default:
          throw new Error(`Unknown onboarding step: ${step}`);
      }

      // Update onboarding step
      profile.onboardingStep = step;

      const updatedProfile = await this.mentorProfileRepository.save(profile);
      this.logger.info(
        `Updated mentor profile step ${step} for user ${userId}`
      );

      return updatedProfile;
    } catch (error) {
      this.logger.error('Error updating mentor onboarding step', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Complete onboarding
  async completeOnboarding(userId: string, data: any): Promise<MentorProfile> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Update all fields
      Object.assign(profile, data);
      profile.isOnboardingComplete = true;
      profile.onboardingStep = 'completed';

      const autoApprove =
        process.env.MENTOR_AUTO_APPROVE_ON_ONBOARDING === 'true';

      if (autoApprove) {
        profile.isApproved = true;
        profile.approvedAt = new Date();
      } else {
        profile.isApproved = false;
        profile.approvedAt = undefined;
      }

      const completedProfile = await this.mentorProfileRepository.save(profile);

      const userUpdateData: any = {
        isOnboardingComplete: true,
      };

      if (autoApprove) {
        userUpdateData.mentorApprovalStatus = MENTOR_APPROVAL_STATUS.APPROVED;
        userUpdateData.mentorApprovedAt = new Date();
      } else {
        userUpdateData.mentorApprovalStatus = MENTOR_APPROVAL_STATUS.PENDING;
        userUpdateData.mentorApprovedAt = null;
      }

      if (data.notificationPreferences) {
        userUpdateData.notificationPreferences = data.notificationPreferences;
      }

      await this.userRepository.update(userId, userUpdateData);

      if (autoApprove) {
        this.logger.info(
          `Completed mentor onboarding and auto-approved for user ${userId} (MENTOR_AUTO_APPROVE_ON_ONBOARDING=true)`
        );

        if (completedProfile.user?.pushToken) {
          await pushNotificationService.sendMentorApprovalNotification(
            completedProfile.user.pushToken,
            userId,
            completedProfile.user.firstName || 'Mentor'
          );
        }

        try {
          const notificationService = getAppNotificationService();
          await notificationService.createNotification({
            userId,
            type: AppNotificationType.MENTOR_APPROVAL,
            title: 'Welcome, Mentor!',
            message:
              'Your profile has been approved. You can now start receiving session requests.',
            data: { type: 'mentor_approval' },
          });
        } catch (notifError: any) {
          this.logger.error(
            'Failed to create in-app notification for mentor approval',
            notifError
          );
        }
      } else {
        this.logger.info(
          `Completed mentor onboarding for user ${userId}; awaiting admin approval`
        );

        try {
          const notificationService = getAppNotificationService();
          await notificationService.createNotification({
            userId,
            type: AppNotificationType.SYSTEM,
            title: 'Application submitted',
            message:
              'Thanks for completing your mentor application. Our team will review it shortly.',
            data: { type: 'mentor_application_submitted' },
          });
        } catch (notifError: any) {
          this.logger.error(
            'Failed to create in-app notification for mentor application submitted',
            notifError
          );
        }
      }

      return completedProfile;
    } catch (error) {
      this.logger.error('Error completing mentor onboarding', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Get profile by user ID
  async getProfile(userId: string): Promise<MentorProfile | null> {
    try {
      const profile = await this.mentorProfileRepository.findOne({
        where: { userId },
        relations: ['user'],
      });

      if (!profile) return null;

      // Fetch dynamic stats
      const totalSessions = await this.sessionRepository.count({
        where: {
          mentorId: userId,
          status: SESSION_STATUS.COMPLETED as any || 'completed',
        },
      });

      const reviews = await this.sessionReviewRepository.count({
        where: { mentorId: userId },
      });

      // Get count of accepted mentees
      const totalMentees = await this.mentorshipRequestRepository.count({
        where: {
          mentorId: userId,
          status: MENTORSHIP_REQUEST_STATUS.ACCEPTED,
        },
      });

      // Attach stats to profile (cast to any to allow dynamic properties)
      const profileWithStats = profile as any;
      profileWithStats.totalMentees = totalMentees;
      profileWithStats.sessions = totalSessions;
      profileWithStats.reviews = reviews;

      return profileWithStats;
    } catch (error) {
      this.logger.error('Error getting mentor profile', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Get onboarding progress
  async getOnboardingProgress(userId: string): Promise<{
    currentStep: string;
    isComplete: boolean;
    progress: number;
  }> {
    try {
      const profile = await this.getProfile(userId);

      if (!profile) {
        return {
          currentStep: 'christianExperience',
          isComplete: false,
          progress: 0,
        };
      }

      const steps = [
        'christianExperience',
        'christianJourney',
        'scriptureTeaching',
        'currentMentoring',
        'churchAffiliation',
        'leadershipRoles',
        'maturityDefinition',
        'menteeCapacity',
        'mentorshipFormat',
        'menteeCalling',
        'videoIntroduction',
        'profileImage',
      ];

      const currentStepIndex = steps.indexOf(profile.onboardingStep);
      const progress = Math.round(
        ((currentStepIndex + 1) / steps.length) * 100
      );

      return {
        currentStep: profile.onboardingStep,
        isComplete: profile.isOnboardingComplete,
        progress: Math.min(progress, 100),
      };
    } catch (error) {
      this.logger.error('Error getting mentor onboarding progress', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Approve mentor (admin function)
  async approveMentor(
    userId: string,
    approvalNotes?: string
  ): Promise<MentorProfile> {
    try {
      const profile = await this.getProfile(userId);

      if (!profile) {
        throw new AppError('Mentor profile not found', 404);
      }

      if (!profile.isOnboardingComplete) {
        throw new AppError('Mentor must complete onboarding before approval', 400);
      }

      if (profile.isApproved) {
        return profile;
      }

      profile.isApproved = true;
      profile.approvalNotes = approvalNotes;
      profile.approvedAt = new Date();

      const approvedProfile = await this.mentorProfileRepository.save(profile);

      // IMPORTANT: Also update User table to sync mentorApprovalStatus
      await this.userRepository.update(userId, {
        mentorApprovalStatus: MENTOR_APPROVAL_STATUS.APPROVED,
        mentorApprovedAt: new Date(),
      });

      this.logger.info(`Approved mentor profile for user ${userId}`);

      // Send push notification
      if (approvedProfile.user?.pushToken) {
        await pushNotificationService.sendMentorApprovalNotification(
          approvedProfile.user.pushToken,
          userId,
          approvedProfile.user.firstName || 'Mentor'
        );
      }

      // Create in-app notification
      try {
        const notificationService = getAppNotificationService();
        await notificationService.createNotification({
          userId,
          type: AppNotificationType.MENTOR_APPROVAL,
          title: '🎉 Profile Approved',
          message: 'An admin has reviewed and approved your mentor profile. Welcome to the team!',
          data: { type: 'mentor_approval' },
        });
      } catch (notifError: any) {
        this.logger.error('Failed to create in-app notification for admin approval', notifError);
      }

      return approvedProfile;
    } catch (error) {
      this.logger.error('Error approving mentor', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async rejectMentor(
    userId: string,
    options?: { reason?: string }
  ): Promise<MentorProfile> {
    const profile = await this.mentorProfileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!profile) {
      throw new AppError('Mentor profile not found', 404);
    }
    if (!profile.isOnboardingComplete) {
      throw new AppError('Mentor must complete onboarding first', 400);
    }

    const user = profile.user;
    if (
      user?.mentorApprovalStatus === MENTOR_APPROVAL_STATUS.REJECTED &&
      !profile.isApproved
    ) {
      return profile;
    }

    profile.isApproved = false;
    profile.approvedAt = undefined;
    await this.mentorProfileRepository.save(profile);

    await this.userRepository.update(userId, {
      mentorApprovalStatus: MENTOR_APPROVAL_STATUS.REJECTED,
      mentorApprovedAt: null as any,
    });

    const reason =
      options?.reason?.trim() ||
      'Unfortunately we are unable to approve your mentor application at this time.';

    if (user?.pushToken) {
      await pushNotificationService.sendToUser({
        userId,
        pushToken: user.pushToken,
        title: 'Mentor application update',
        body: reason.slice(0, 180),
        data: { type: 'mentor_application_rejected' },
      });
    }

    try {
      const notificationService = getAppNotificationService();
      await notificationService.createNotification({
        userId,
        type: AppNotificationType.SYSTEM,
        title: 'Mentor application',
        message: reason,
        data: { type: 'mentor_application_rejected' },
      });
    } catch (e) {
      this.logger.error('rejectMentor in-app notification failed', e as Error);
    }

    this.logger.info(`Rejected mentor application for user ${userId}`);
    return (await this.getProfile(userId)) as MentorProfile;
  }

  async markMentorNeedsMoreInfo(
    userId: string,
    options?: { message?: string }
  ): Promise<MentorProfile> {
    const profile = await this.mentorProfileRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!profile) {
      throw new AppError('Mentor profile not found', 404);
    }
    if (!profile.isOnboardingComplete) {
      throw new AppError('Mentor must complete onboarding first', 400);
    }

    profile.isApproved = false;
    profile.approvedAt = undefined;
    await this.mentorProfileRepository.save(profile);

    await this.userRepository.update(userId, {
      mentorApprovalStatus: MENTOR_APPROVAL_STATUS.NEEDS_MORE_INFO,
      mentorApprovedAt: null as any,
    });

    const user = profile.user;
    const msg =
      options?.message?.trim() ||
      'We need a bit more information to continue reviewing your mentor application. Please open the app for details.';

    if (user?.pushToken) {
      await pushNotificationService.sendToUser({
        userId,
        pushToken: user.pushToken,
        title: 'More information needed',
        body: msg.slice(0, 180),
        data: { type: 'mentor_application_needs_info' },
      });
    }

    try {
      const notificationService = getAppNotificationService();
      await notificationService.createNotification({
        userId,
        type: AppNotificationType.SYSTEM,
        title: 'More information needed',
        message: msg,
        data: { type: 'mentor_application_needs_info' },
      });
    } catch (e) {
      this.logger.error(
        'markMentorNeedsMoreInfo in-app notification failed',
        e as Error
      );
    }

    this.logger.info(`Marked mentor application needs_more_info for user ${userId}`);
    return (await this.getProfile(userId)) as MentorProfile;
  }

  async appendInternalAdminNote(
    userId: string,
    adminUserId: string,
    body: string
  ): Promise<MentorProfile> {
    const profile = await this.mentorProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) {
      throw new AppError('Mentor profile not found', 404);
    }

    const prev = Array.isArray(profile.internalAdminNotes)
      ? [...profile.internalAdminNotes]
      : [];
    prev.push({
      createdAt: new Date().toISOString(),
      adminUserId,
      body: body.trim(),
    });
    profile.internalAdminNotes = prev;
    return await this.mentorProfileRepository.save(profile);
  }

  // Get all pending mentors
  async getPendingMentors(): Promise<MentorProfile[]> {
    try {
      return await this.mentorProfileRepository
        .createQueryBuilder('mp')
        .innerJoinAndSelect('mp.user', 'user')
        .where('mp.isOnboardingComplete = :c', { c: true })
        .andWhere('mp.isApproved = :a', { a: false })
        .andWhere(
          '(user.mentorApprovalStatus IS NULL OR user.mentorApprovalStatus = :pending)',
          { pending: MENTOR_APPROVAL_STATUS.PENDING }
        )
        .orderBy('mp.updatedAt', 'DESC')
        .getMany();
    } catch (error) {
      this.logger.error('Error getting pending mentors', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Update mentor profile (multiple fields at once)
  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      country?: string;
      christianExperience?: string;
      christianJourney?: string;
      scriptureTeaching?: string;
      currentMentoring?: string;
      churchAffiliation?: string;
      leadershipRoles?: string;
      maturityDefinition?: string;
      menteeCapacity?: number;
      sessionDuration?: number;
      mentorshipFormat?: string[];
      menteeCalling?: string[];
      profileImage?: string;
    }
  ): Promise<MentorProfile> {
    try {
      const profile = await this.getProfile(userId);

      if (!profile) {
        throw new Error('Mentor profile not found');
      }

      // Update user fields if provided
      if (data.firstName || data.lastName || data.email || data.country) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });

        if (!user) {
          throw new Error('User not found');
        }

        if (data.firstName !== undefined) {
          user.firstName = data.firstName;
        }
        if (data.lastName !== undefined) {
          user.lastName = data.lastName;
        }
        if (data.email !== undefined) {
          user.email = data.email.toLowerCase();
        }
        if (data.country !== undefined) {
          user.country = data.country;
        }

        await this.userRepository.save(user);
      }

      // Update profile fields
      if (data.christianExperience !== undefined) {
        profile.christianExperience = data.christianExperience;
      }
      if (data.christianJourney !== undefined) {
        profile.christianJourney = data.christianJourney;
      }
      if (data.scriptureTeaching !== undefined) {
        profile.scriptureTeaching = data.scriptureTeaching;
      }
      if (data.currentMentoring !== undefined) {
        profile.currentMentoring = data.currentMentoring;
      }
      if (data.churchAffiliation !== undefined) {
        profile.churchAffiliation = data.churchAffiliation;
      }
      if (data.leadershipRoles !== undefined) {
        profile.leadershipRoles = data.leadershipRoles;
      }
      if (data.maturityDefinition !== undefined) {
        profile.maturityDefinition = data.maturityDefinition;
      }
      if (data.menteeCapacity !== undefined) {
        profile.menteeCapacity = data.menteeCapacity;
      }
      if (data.sessionDuration !== undefined) {
        const allowed = [30, 45, 60];
        if (!allowed.includes(data.sessionDuration)) {
          throw new Error(`Invalid session duration. Allowed values: ${allowed.join(', ')} minutes`);
        }
        profile.sessionDuration = data.sessionDuration;
      }
      if (data.mentorshipFormat !== undefined) {
        profile.mentorshipFormat = data.mentorshipFormat;
      }
      if (data.menteeCalling !== undefined) {
        profile.menteeCalling = data.menteeCalling;
      }
      if (data.profileImage !== undefined) {
        profile.profileImage = data.profileImage;
      }

      const updatedProfile = await this.mentorProfileRepository.save(profile);
      this.logger.info(`Updated mentor profile for user ${userId}`);

      return updatedProfile;
    } catch (error) {
      this.logger.error('Error updating mentor profile', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Update current book and chapter (for Bible reading tracking)
  async updateCurrentBook(
    userId: string,
    currentBook: string,
    currentChapter: number
  ): Promise<MentorProfile> {
    try {
      const profile = await this.getOrCreateProfile(userId);
      profile.currentBook = currentBook;
      profile.currentChapter = currentChapter;

      const updatedProfile = await this.mentorProfileRepository.save(profile);
      this.logger.info(
        `Updated current book to ${currentBook} ${currentChapter} for mentor ${userId}`
      );

      return updatedProfile;
    } catch (error) {
      this.logger.error('Error updating current book', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
