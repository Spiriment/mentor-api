import { Request, Response, NextFunction } from 'express';
import { MenteeProfileService } from '../services/menteeProfile.service';
import { Logger } from '../common';

export class MenteeProfileController {
  private menteeProfileService: MenteeProfileService;
  private logger: Logger;

  constructor() {
    this.menteeProfileService = new MenteeProfileService();
    this.logger = new Logger({
      service: 'mentee-profile-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  // Get mentee profile
  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const profile = await this.menteeProfileService.getProfile(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Mentee profile not found',
            code: 'PROFILE_NOT_FOUND',
          },
        });
      }

      // Format full profile data similar to mentor profile
      const formattedMentee = {
        id: profile.id,
        userId: profile.userId,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
        profileImage: profile.profileImage,
        country: profile.user.country,
        bibleReadingFrequency: profile.bibleReadingFrequency,
        scriptureConfidence: profile.scriptureConfidence,
        currentMentorship: profile.currentMentorship,
        spiritualGrowthAreas: profile.spiritualGrowthAreas,
        christianExperience: profile.christianExperience,
        bibleTopics: profile.bibleTopics,
        learningPreference: profile.learningPreference,
        mentorshipFormat: profile.mentorshipFormat,
        mentorExpectations: profile.mentorExpectations,
        spiritualGoals: profile.spiritualGoals,
        currentBook: profile.currentBook,
        currentChapter: profile.currentChapter,
        lastSessionDate: (profile as any).lastSessionDate,
      };

      res.json({
        success: true,
        data: formattedMentee,
        message: 'Mentee profile retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting mentee profile', error);
      next(error);
    }
  };

  // Get onboarding progress
  getOnboardingProgress = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;

      const progress = await this.menteeProfileService.getOnboardingProgress(
        userId
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      this.logger.error('Error getting mentee onboarding progress', error);
      next(error);
    }
  };

  // Update specific onboarding step
  updateOnboardingStep = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId, step } = req.params;
      const data = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        step,
        data
      );

      res.json({
        success: true,
        data: profile,
        message: `Updated ${step} successfully`,
      });
    } catch (error: any) {
      this.logger.error('Error updating mentee onboarding step', error);
      next(error);
    }
  };

  // Update current book and chapter
  updateCurrentBook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { currentBook, currentChapter } = req.body;

      if (!currentBook) {
        return res.status(400).json({
          success: false,
          message: 'currentBook is required',
        });
      }

      const profile = await this.menteeProfileService.updateCurrentBook(
        userId,
        currentBook,
        currentChapter || 1
      );

      res.json({
        success: true,
        data: profile,
        message: 'Current book updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating current book', error);
      next(error);
    }
  };

  // Complete onboarding
  completeOnboarding = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const data = req.body;

      const profile = await this.menteeProfileService.completeOnboarding(
        userId,
        data
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentee onboarding completed successfully',
      });
    } catch (error: any) {
      this.logger.error('Error completing mentee onboarding', error);
      next(error);
    }
  };

  // Specific step handlers
  updateBibleReadingFrequency = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { bibleReadingFrequency } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'bibleReadingFrequency',
        { bibleReadingFrequency }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Bible reading frequency updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating bible reading frequency', error);
      next(error);
    }
  };

  updateScriptureConfidence = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { scriptureConfidence } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'scriptureConfidence',
        { scriptureConfidence }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Scripture confidence updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating scripture confidence', error);
      next(error);
    }
  };

  updateCurrentMentorship = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { currentMentorship } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'currentMentorship',
        { currentMentorship }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Current mentorship status updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating current mentorship', error);
      next(error);
    }
  };

  updateSpiritualGrowthAreas = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { spiritualGrowthAreas } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'spiritualGrowthAreas',
        { spiritualGrowthAreas }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Spiritual growth areas updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating spiritual growth areas', error);
      next(error);
    }
  };

  updateChristianExperience = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { christianExperience } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'christianExperience',
        { christianExperience }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Christian experience updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating christian experience', error);
      next(error);
    }
  };

  updateBibleTopics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { bibleTopics } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'bibleTopics',
        { bibleTopics }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Bible topics updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating bible topics', error);
      next(error);
    }
  };

  updateLearningPreference = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { learningPreference } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'learningPreference',
        { learningPreference }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Learning preference updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating learning preference', error);
      next(error);
    }
  };

  updateMentorshipFormat = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { mentorshipFormat } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'mentorshipFormat',
        { mentorshipFormat }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentorship format updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating mentorship format', error);
      next(error);
    }
  };

  updateMentorExpectations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { mentorExpectations } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'mentorExpectations',
        { mentorExpectations }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentor expectations updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating mentor expectations', error);
      next(error);
    }
  };

  updateSpiritualGoals = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { spiritualGoals } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'spiritualGoals',
        { spiritualGoals }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Spiritual goals updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating spiritual goals', error);
      next(error);
    }
  };

  updateProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { profileImage } = req.body;

      const profile = await this.menteeProfileService.updateOnboardingStep(
        userId,
        'profileImage',
        { profileImage }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Profile image updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating profile image', error);
      next(error);
    }
  };
}
