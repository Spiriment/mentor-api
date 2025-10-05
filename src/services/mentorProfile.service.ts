import { Repository } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { MentorProfile } from '../database/entities/mentorProfile.entity';
import { User } from '../database/entities/user.entity';
import { Logger } from '../common';

export class MentorProfileService {
  private mentorProfileRepository: Repository<MentorProfile>;
  private userRepository: Repository<User>;
  private logger: Logger;

  constructor() {
    this.mentorProfileRepository = AppDataSource.getRepository(MentorProfile);
    this.userRepository = AppDataSource.getRepository(User);
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
          where: { id: userId, role: 'mentor' },
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
      this.logger.error('Error getting or creating mentor profile', error);
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
      this.logger.error('Error updating mentor onboarding step', error);
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

      const completedProfile = await this.mentorProfileRepository.save(profile);
      this.logger.info(`Completed mentor onboarding for user ${userId}`);

      return completedProfile;
    } catch (error) {
      this.logger.error('Error completing mentor onboarding', error);
      throw error;
    }
  }

  // Get profile by user ID
  async getProfile(userId: string): Promise<MentorProfile | null> {
    try {
      return await this.mentorProfileRepository.findOne({
        where: { userId },
        relations: ['user'],
      });
    } catch (error) {
      this.logger.error('Error getting mentor profile', error);
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
      this.logger.error('Error getting mentor onboarding progress', error);
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
        throw new Error('Mentor profile not found');
      }

      if (!profile.isOnboardingComplete) {
        throw new Error('Mentor must complete onboarding before approval');
      }

      profile.isApproved = true;
      profile.approvalNotes = approvalNotes;
      profile.approvedAt = new Date();

      const approvedProfile = await this.mentorProfileRepository.save(profile);
      this.logger.info(`Approved mentor profile for user ${userId}`);

      return approvedProfile;
    } catch (error) {
      this.logger.error('Error approving mentor', error);
      throw error;
    }
  }

  // Get all pending mentors
  async getPendingMentors(): Promise<MentorProfile[]> {
    try {
      return await this.mentorProfileRepository.find({
        where: {
          isOnboardingComplete: true,
          isApproved: false,
        },
        relations: ['user'],
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error('Error getting pending mentors', error);
      throw error;
    }
  }
}
