import { Router } from 'express';
import { MentorProfileController } from '../controllers/mentorProfile.controller';
import { validate } from '../common';
import {
  mentorChristianExperienceSchema,
  mentorChristianJourneySchema,
  mentorScriptureTeachingSchema,
  mentorCurrentMentoringSchema,
  mentorChurchAffiliationSchema,
  mentorLeadershipRolesSchema,
  mentorMaturityDefinitionSchema,
  mentorMenteeCapacitySchema,
  mentorMentorshipFormatSchema,
  mentorMenteeCallingSchema,
  mentorVideoIntroductionSchema,
  mentorProfileImageSchema,
  completeMentorOnboardingSchema,
} from '../validation/mentor.validation';

const router = Router();
const mentorProfileController = new MentorProfileController();

// Get mentor profile
router.get('/:userId', mentorProfileController.getProfile);

// Get onboarding progress
router.get(
  '/:userId/onboarding-progress',
  mentorProfileController.getOnboardingProgress
);

// Update specific onboarding step
router.put(
  '/:userId/onboarding/:step',
  mentorProfileController.updateOnboardingStep
);

// Complete onboarding
router.post(
  '/:userId/complete-onboarding',
  validate(completeMentorOnboardingSchema),
  mentorProfileController.completeOnboarding
);

// Admin functions
router.get('/admin/pending', mentorProfileController.getPendingMentors);
router.post('/:userId/approve', mentorProfileController.approveMentor);

// Specific step handlers
router.put(
  '/:userId/christian-experience',
  validate(mentorChristianExperienceSchema),
  mentorProfileController.updateChristianExperience
);

router.put(
  '/:userId/christian-journey',
  validate(mentorChristianJourneySchema),
  mentorProfileController.updateChristianJourney
);

router.put(
  '/:userId/scripture-teaching',
  validate(mentorScriptureTeachingSchema),
  mentorProfileController.updateScriptureTeaching
);

router.put(
  '/:userId/current-mentoring',
  validate(mentorCurrentMentoringSchema),
  mentorProfileController.updateCurrentMentoring
);

router.put(
  '/:userId/church-affiliation',
  validate(mentorChurchAffiliationSchema),
  mentorProfileController.updateChurchAffiliation
);

router.put(
  '/:userId/leadership-roles',
  validate(mentorLeadershipRolesSchema),
  mentorProfileController.updateLeadershipRoles
);

router.put(
  '/:userId/maturity-definition',
  validate(mentorMaturityDefinitionSchema),
  mentorProfileController.updateMaturityDefinition
);

router.put(
  '/:userId/mentee-capacity',
  validate(mentorMenteeCapacitySchema),
  mentorProfileController.updateMenteeCapacity
);

router.put(
  '/:userId/mentorship-format',
  validate(mentorMentorshipFormatSchema),
  mentorProfileController.updateMentorshipFormat
);

router.put(
  '/:userId/mentee-calling',
  validate(mentorMenteeCallingSchema),
  mentorProfileController.updateMenteeCalling
);

router.put(
  '/:userId/video-introduction',
  validate(mentorVideoIntroductionSchema),
  mentorProfileController.updateVideoIntroduction
);

router.put(
  '/:userId/profile-image',
  validate(mentorProfileImageSchema),
  mentorProfileController.updateProfileImage
);

export { router as mentorProfileRoutes };
