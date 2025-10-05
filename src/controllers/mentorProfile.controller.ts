import { Request, Response, NextFunction } from 'express';
import { MentorProfileService } from '../services/mentorProfile.service';
import { Logger } from '../common';

export class MentorProfileController {
  private mentorProfileService: MentorProfileService;
  private logger: Logger;

  constructor() {
    this.mentorProfileService = new MentorProfileService();
    this.logger = new Logger({
      service: 'mentor-profile-controller',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  // Get mentor profile
  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const profile = await this.mentorProfileService.getProfile(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Mentor profile not found',
            code: 'PROFILE_NOT_FOUND',
          },
        });
      }

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      this.logger.error('Error getting mentor profile', error);
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

      const progress = await this.mentorProfileService.getOnboardingProgress(
        userId
      );

      res.json({
        success: true,
        data: progress,
      });
    } catch (error: any) {
      this.logger.error('Error getting mentor onboarding progress', error);
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

      const profile = await this.mentorProfileService.updateOnboardingStep(
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
      this.logger.error('Error updating mentor onboarding step', error);
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

      const profile = await this.mentorProfileService.completeOnboarding(
        userId,
        data
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentor onboarding completed successfully',
      });
    } catch (error: any) {
      this.logger.error('Error completing mentor onboarding', error);
      next(error);
    }
  };

  // Get pending mentors (admin function)
  getPendingMentors = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const mentors = await this.mentorProfileService.getPendingMentors();

      res.json({
        success: true,
        data: mentors,
        message: 'Pending mentors retrieved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error getting pending mentors', error);
      next(error);
    }
  };

  // Approve mentor (admin function)
  approveMentor = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { approvalNotes } = req.body;

      const profile = await this.mentorProfileService.approveMentor(
        userId,
        approvalNotes
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentor approved successfully',
      });
    } catch (error: any) {
      this.logger.error('Error approving mentor', error);
      next(error);
    }
  };

  // Specific step handlers
  updateChristianExperience = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { christianExperience } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
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

  updateChristianJourney = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { christianJourney } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'christianJourney',
        { christianJourney }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Christian journey updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating christian journey', error);
      next(error);
    }
  };

  updateScriptureTeaching = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { scriptureTeaching } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'scriptureTeaching',
        { scriptureTeaching }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Scripture teaching experience updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating scripture teaching', error);
      next(error);
    }
  };

  updateCurrentMentoring = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { currentMentoring } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'currentMentoring',
        { currentMentoring }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Current mentoring status updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating current mentoring', error);
      next(error);
    }
  };

  updateChurchAffiliation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { churchAffiliation } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'churchAffiliation',
        { churchAffiliation }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Church affiliation updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating church affiliation', error);
      next(error);
    }
  };

  updateLeadershipRoles = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { leadershipRoles } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'leadershipRoles',
        { leadershipRoles }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Leadership roles updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating leadership roles', error);
      next(error);
    }
  };

  updateMaturityDefinition = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { maturityDefinition } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'maturityDefinition',
        { maturityDefinition }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Maturity definition updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating maturity definition', error);
      next(error);
    }
  };

  updateMenteeCapacity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { menteeCapacity } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'menteeCapacity',
        { menteeCapacity }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentee capacity updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating mentee capacity', error);
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

      const profile = await this.mentorProfileService.updateOnboardingStep(
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

  updateMenteeCalling = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { menteeCalling } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'menteeCalling',
        { menteeCalling }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Mentee calling updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating mentee calling', error);
      next(error);
    }
  };

  updateVideoIntroduction = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { videoIntroduction } = req.body;

      const profile = await this.mentorProfileService.updateOnboardingStep(
        userId,
        'videoIntroduction',
        { videoIntroduction }
      );

      res.json({
        success: true,
        data: profile,
        message: 'Video introduction updated successfully',
      });
    } catch (error: any) {
      this.logger.error('Error updating video introduction', error);
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

      const profile = await this.mentorProfileService.updateOnboardingStep(
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
