import { Repository } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { MenteeProfile } from '../database/entities/menteeProfile.entity';
import { User } from '../database/entities/user.entity';
import { Logger, USER_ROLE } from '../common';

export class MenteeProfileService {
  private menteeProfileRepository: Repository<MenteeProfile>;
  private userRepository: Repository<User>;
  private logger: Logger;

  constructor() {
    this.menteeProfileRepository = AppDataSource.getRepository(MenteeProfile);
    this.userRepository = AppDataSource.getRepository(User);
    this.logger = new Logger({
      service: 'mentee-profile-service',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  // Create or get mentee profile
  async getOrCreateProfile(userId: string): Promise<MenteeProfile> {
    try {
      let profile = await this.menteeProfileRepository.findOne({
        where: { userId },
        relations: ['user'],
      });

      if (!profile) {
        // Verify user exists and has mentee role
        const user = await this.userRepository.findOne({
          where: { id: userId, role: USER_ROLE.MENTEE as any },
        });

        if (!user) {
          throw new Error('User not found or not a mentee');
        }

        // Create new profile
        profile = this.menteeProfileRepository.create({
          userId,
          onboardingStep: 'bibleReadingFrequency',
        });

        profile = await this.menteeProfileRepository.save(profile);
        this.logger.info(`Created mentee profile for user ${userId}`);
      }

      return profile;
    } catch (error) {
      this.logger.error('Error getting or creating mentee profile', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Update specific onboarding step
  async updateOnboardingStep(
    userId: string,
    step: string,
    data: any
  ): Promise<MenteeProfile> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Update the specific field based on step
      switch (step) {
        case 'bibleReadingFrequency':
          profile.bibleReadingFrequency = data.bibleReadingFrequency;
          break;
        case 'scriptureConfidence':
          profile.scriptureConfidence = data.scriptureConfidence;
          break;
        case 'currentMentorship':
          profile.currentMentorship = data.currentMentorship;
          break;
        case 'spiritualGrowthAreas':
          profile.spiritualGrowthAreas = data.spiritualGrowthAreas;
          break;
        case 'christianExperience':
          profile.christianExperience = data.christianExperience;
          break;
        case 'bibleTopics':
          profile.bibleTopics = data.bibleTopics;
          break;
        case 'learningPreference':
          profile.learningPreference = data.learningPreference;
          break;
        case 'mentorshipFormat':
          profile.mentorshipFormat = data.mentorshipFormat;
          break;
        case 'availability':
          profile.availability = data.availability;
          break;
        case 'mentorExpectations':
          profile.mentorExpectations = data.mentorExpectations;
          break;
        case 'spiritualGoals':
          profile.spiritualGoals = data.spiritualGoals;
          break;
        case 'profileImage':
          profile.profileImage = data.profileImage;
          break;
        default:
          throw new Error(`Unknown onboarding step: ${step}`);
      }

      // Update onboarding step
      profile.onboardingStep = step;

      const updatedProfile = await this.menteeProfileRepository.save(profile);
      this.logger.info(
        `Updated mentee profile step ${step} for user ${userId}`
      );

      return updatedProfile;
    } catch (error) {
      this.logger.error('Error updating mentee onboarding step', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Complete onboarding
  async completeOnboarding(userId: string, data: any): Promise<MenteeProfile> {
    try {
      const profile = await this.getOrCreateProfile(userId);

      // Update all fields
      Object.assign(profile, data);
      profile.isOnboardingComplete = true;
      profile.onboardingStep = 'completed';

      const completedProfile = await this.menteeProfileRepository.save(profile);
      this.logger.info(`Completed mentee onboarding for user ${userId}`);

      return completedProfile;
    } catch (error) {
      this.logger.error('Error completing mentee onboarding', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // Get profile by user ID
  async getProfile(userId: string): Promise<MenteeProfile | null> {
    try {
      return await this.menteeProfileRepository.findOne({
        where: { userId },
        relations: ['user'],
      });
    } catch (error) {
      this.logger.error('Error getting mentee profile', error instanceof Error ? error : new Error(String(error)));
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
          currentStep: 'bibleReadingFrequency',
          isComplete: false,
          progress: 0,
        };
      }

      const steps = [
        'bibleReadingFrequency',
        'scriptureConfidence',
        'currentMentorship',
        'spiritualGrowthAreas',
        'christianExperience',
        'bibleTopics',
        'learningPreference',
        'mentorshipFormat',
        'availability',
        'mentorExpectations',
        'spiritualGoals',
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
      this.logger.error('Error getting mentee onboarding progress', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
