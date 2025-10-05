import { z } from 'zod';
import {
  SESSION_TYPE,
  SESSION_DURATION,
  SESSION_STATUS,
} from '@/database/entities/session.entity';
import { DAY_OF_WEEK } from '@/database/entities/mentorAvailability.entity';

// Create session validation
export const createSessionSchema = z.object({
  mentorId: z.string().uuid('Invalid mentor ID'),
  scheduledAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
  type: z.nativeEnum(SESSION_TYPE).optional(),
  duration: z.nativeEnum(SESSION_DURATION).optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title too long')
    .optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  meetingLink: z.string().url('Invalid meeting link').optional(),
  meetingId: z.string().min(1, 'Meeting ID is required').optional(),
  meetingPassword: z.string().min(1, 'Meeting password is required').optional(),
  location: z.string().max(200, 'Location too long').optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: z
    .string()
    .min(1, 'Recurring pattern is required')
    .optional(),
});

// Update session validation
export const updateSessionSchema = z.object({
  scheduledAt: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid date format',
    })
    .optional(),
  type: z.nativeEnum(SESSION_TYPE).optional(),
  duration: z.nativeEnum(SESSION_DURATION).optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title too long')
    .optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  meetingLink: z.string().url('Invalid meeting link').optional(),
  meetingId: z.string().min(1, 'Meeting ID is required').optional(),
  meetingPassword: z.string().min(1, 'Meeting password is required').optional(),
  location: z.string().max(200, 'Location too long').optional(),
  mentorNotes: z.string().max(1000, 'Notes too long').optional(),
  menteeNotes: z.string().max(1000, 'Notes too long').optional(),
  sessionNotes: z.string().max(1000, 'Notes too long').optional(),
  status: z.nativeEnum(SESSION_STATUS).optional(),
});

// Cancel session validation
export const cancelSessionSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
});

// Create availability validation
export const createAvailabilitySchema = z.object({
  dayOfWeek: z.nativeEnum(DAY_OF_WEEK),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format. Use HH:MM format',
  }),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid time format. Use HH:MM format',
  }),
  slotDuration: z
    .number()
    .min(15, 'Minimum slot duration is 15 minutes')
    .max(240, 'Maximum slot duration is 240 minutes')
    .optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  specificDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid date format',
    })
    .optional(),
  breaks: z
    .array(
      z.object({
        startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
          message: 'Invalid break start time format',
        }),
        endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
          message: 'Invalid break end time format',
        }),
        reason: z.string().max(200, 'Break reason too long').optional(),
      })
    )
    .optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

// Update session status validation
export const updateSessionStatusSchema = z.object({
  status: z.nativeEnum(SESSION_STATUS, {
    errorMap: () => ({ message: 'Invalid session status' }),
  }),
});

// Query parameters validation
export const sessionQuerySchema = z.object({
  status: z.nativeEnum(SESSION_STATUS).optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/, 'Offset must be a number')
    .transform(Number)
    .optional(),
  upcoming: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

// Date parameter validation
export const dateParamSchema = z.object({
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
});
