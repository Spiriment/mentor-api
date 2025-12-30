import { z } from 'zod';

// Mentee onboarding step validation schemas
export const menteeBibleReadingFrequencySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  bibleReadingFrequency: z
    .string()
    .min(1, 'Bible reading frequency is required'),
});

export const menteeScriptureConfidenceSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  scriptureConfidence: z.string().min(1, 'Scripture confidence is required'),
});

export const menteeCurrentMentorshipSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  currentMentorship: z.string().min(1, 'Current mentorship status is required'),
});

export const menteeSpiritualGrowthAreasSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  spiritualGrowthAreas: z
    .array(z.string())
    .min(1, 'At least one spiritual growth area is required'),
});

export const menteeChristianExperienceSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  christianExperience: z.string().min(1, 'Christian experience is required'),
});

export const menteeBibleTopicsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  bibleTopics: z
    .array(z.string())
    .min(1, 'At least one Bible topic is required'),
});

export const menteeLearningPreferenceSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  learningPreference: z.string().min(1, 'Learning preference is required'),
});

export const menteeMentorshipFormatSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  mentorshipFormat: z
    .array(z.string())
    .min(1, 'At least one mentorship format is required'),
});

export const menteeAvailabilitySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  availability: z
    .array(z.string())
    .min(1, 'At least one availability option is required'),
});

export const menteeMentorExpectationsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  mentorExpectations: z
    .array(z.string())
    .min(1, 'At least one mentor expectation is required'),
});

export const menteeSpiritualGoalsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  spiritualGoals: z
    .array(z.string())
    .min(1, 'At least one spiritual goal is required'),
});

export const menteeProfileImageSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  profileImage: z.string().min(1, 'Profile image is required'),
});

// Complete mentee onboarding
export const completeMenteeOnboardingSchema = z.object({
  // userId comes from route params, not body
  bibleReadingFrequency: z
    .string()
    .min(1, 'Bible reading frequency is required'),
  scriptureConfidence: z.string().min(1, 'Scripture confidence is required'),
  currentMentorship: z.string().min(1, 'Current mentorship status is required'),
  spiritualGrowthAreas: z
    .array(z.string())
    .min(1, 'At least one spiritual growth area is required'),
  christianExperience: z.string().min(1, 'Christian experience is required'),
  bibleTopics: z
    .array(z.string())
    .min(1, 'At least one Bible topic is required'),
  learningPreference: z.string().min(1, 'Learning preference is required'),
  mentorshipFormat: z
    .array(z.string())
    .min(1, 'At least one mentorship format is required'),
  availability: z
    .array(z.string())
    .optional(),
  mentorExpectations: z
    .array(z.string())
    .min(1, 'At least one mentor expectation is required'),
  spiritualGoals: z
    .array(z.string())
    .min(1, 'At least one spiritual goal is required'),
  profileImage: z.string().optional(), // Optional - can be empty string
});
