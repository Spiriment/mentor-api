import { Router } from 'express';
import { MenteeProfileController } from '../controllers/menteeProfile.controller';
import { validate } from '../common';
import {
  menteeBibleReadingFrequencySchema,
  menteeScriptureConfidenceSchema,
  menteeCurrentMentorshipSchema,
  menteeSpiritualGrowthAreasSchema,
  menteeChristianExperienceSchema,
  menteeBibleTopicsSchema,
  menteeLearningPreferenceSchema,
  menteeMentorshipFormatSchema,
  menteeAvailabilitySchema,
  menteeMentorExpectationsSchema,
  menteeSpiritualGoalsSchema,
  menteeProfileImageSchema,
  completeMenteeOnboardingSchema,
} from '../validation/mentee.validation';

const router = Router();
const menteeProfileController = new MenteeProfileController();

// Get mentee profile
router.get('/:userId', menteeProfileController.getProfile);

// Get onboarding progress
router.get(
  '/:userId/onboarding-progress',
  menteeProfileController.getOnboardingProgress
);

// Update specific onboarding step
router.put(
  '/:userId/onboarding/:step',
  menteeProfileController.updateOnboardingStep
);

// Complete onboarding
router.post(
  '/:userId/complete-onboarding',
  validate(completeMenteeOnboardingSchema),
  menteeProfileController.completeOnboarding
);

// Specific step handlers
router.put(
  '/:userId/bible-reading-frequency',
  validate(menteeBibleReadingFrequencySchema),
  menteeProfileController.updateBibleReadingFrequency
);

router.put(
  '/:userId/scripture-confidence',
  validate(menteeScriptureConfidenceSchema),
  menteeProfileController.updateScriptureConfidence
);

router.put(
  '/:userId/current-mentorship',
  validate(menteeCurrentMentorshipSchema),
  menteeProfileController.updateCurrentMentorship
);

router.put(
  '/:userId/spiritual-growth-areas',
  validate(menteeSpiritualGrowthAreasSchema),
  menteeProfileController.updateSpiritualGrowthAreas
);

router.put(
  '/:userId/christian-experience',
  validate(menteeChristianExperienceSchema),
  menteeProfileController.updateChristianExperience
);

router.put(
  '/:userId/bible-topics',
  validate(menteeBibleTopicsSchema),
  menteeProfileController.updateBibleTopics
);

router.put(
  '/:userId/learning-preference',
  validate(menteeLearningPreferenceSchema),
  menteeProfileController.updateLearningPreference
);

router.put(
  '/:userId/mentorship-format',
  validate(menteeMentorshipFormatSchema),
  menteeProfileController.updateMentorshipFormat
);

router.put(
  '/:userId/availability',
  validate(menteeAvailabilitySchema),
  menteeProfileController.updateAvailability
);

router.put(
  '/:userId/mentor-expectations',
  validate(menteeMentorExpectationsSchema),
  menteeProfileController.updateMentorExpectations
);

router.put(
  '/:userId/spiritual-goals',
  validate(menteeSpiritualGoalsSchema),
  menteeProfileController.updateSpiritualGoals
);

router.put(
  '/:userId/profile-image',
  validate(menteeProfileImageSchema),
  menteeProfileController.updateProfileImage
);

export { router as menteeProfileRoutes };
