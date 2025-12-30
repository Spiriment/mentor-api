import { z } from 'zod';

// Mentor onboarding step validation schemas
export const mentorChristianExperienceSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  christianExperience: z.string().min(1, 'Christian experience is required'),
});

export const mentorChristianJourneySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  christianJourney: z
    .string()
    .min(10, 'Christian journey must be at least 10 characters'),
});

export const mentorScriptureTeachingSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  scriptureTeaching: z
    .string()
    .min(1, 'Scripture teaching experience is required'),
});

export const mentorCurrentMentoringSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  currentMentoring: z.string().min(1, 'Current mentoring status is required'),
});

export const mentorChurchAffiliationSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  churchAffiliation: z.string().min(1, 'Church affiliation is required'),
});

export const mentorLeadershipRolesSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  leadershipRoles: z.string().min(1, 'Leadership roles is required'),
});

export const mentorMaturityDefinitionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  maturityDefinition: z
    .string()
    .min(10, 'Maturity definition must be at least 10 characters'),
});

export const mentorMenteeCapacitySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  menteeCapacity: z.number().int().positive('Mentee capacity must be a positive number'),
});

export const mentorMentorshipFormatSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  mentorshipFormat: z
    .array(z.string())
    .min(1, 'At least one mentorship format is required'),
});

export const mentorMenteeCallingSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  menteeCalling: z
    .array(z.string())
    .min(1, 'At least one mentee calling is required'),
});

export const mentorVideoIntroductionSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  videoIntroduction: z.string().min(1, 'Video introduction is required'),
});

export const mentorProfileImageSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  profileImage: z.string().min(1, 'Profile image is required'),
});

// Generic profile update schema (all fields optional)
export const updateMentorProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  country: z.string().optional(),
  christianExperience: z.string().optional(),
  christianJourney: z.string().optional(),
  scriptureTeaching: z.string().optional(),
  currentMentoring: z.string().optional(),
  churchAffiliation: z.string().optional(),
  leadershipRoles: z.string().optional(),
  maturityDefinition: z.string().optional(),
  menteeCapacity: z.number().int().positive().optional(),
  mentorshipFormat: z.array(z.string()).optional(),
  menteeCalling: z.array(z.string()).optional(),
  profileImage: z.string().url('Invalid profile image URL').optional(),
});

// Complete mentor onboarding
export const completeMentorOnboardingSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  christianExperience: z.string().min(1, 'Christian experience is required'),
  christianJourney: z
    .string()
    .min(10, 'Christian journey must be at least 10 characters'),
  scriptureTeaching: z
    .string()
    .min(1, 'Scripture teaching experience is required'),
  currentMentoring: z.string().min(1, 'Current mentoring status is required'),
  churchAffiliation: z.string().min(1, 'Church affiliation is required'),
  leadershipRoles: z.string().min(1, 'Leadership roles is required'),
  maturityDefinition: z
    .string()
    .min(10, 'Maturity definition must be at least 10 characters'),
  menteeCapacity: z.coerce.number().int().positive('Mentee capacity must be a positive number'),
  mentorshipFormat: z
    .array(z.string())
    .min(1, 'At least one mentorship format is required'),
  menteeCalling: z
    .array(z.string())
    .min(1, 'At least one mentee calling is required'),
  videoIntroduction: z
    .string()
    .min(1, 'Video introduction is required')
    .optional(),
  profileImage: z.string().min(1, 'Profile image is required').optional(),
});
