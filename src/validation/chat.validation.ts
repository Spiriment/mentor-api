import { z } from 'zod';
import { CONVERSATION_TYPE, MESSAGE_TYPE } from '@/database/entities';

// Create conversation validation
export const createConversationSchema = z.object({
  participantIds: z
    .array(z.string().uuid())
    .min(1, 'At least one participant is required')
    .max(10, 'Maximum 10 participants allowed'),
  type: z
    .nativeEnum(CONVERSATION_TYPE)
    .optional()
    .default(CONVERSATION_TYPE.MENTOR_MENTEE),
  title: z.string().max(255, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
});

// Send message validation
export const sendMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(5000, 'Message too long'),
  type: z.nativeEnum(MESSAGE_TYPE).optional().default(MESSAGE_TYPE.TEXT),
  metadata: z
    .object({
      fileUrl: z.string().url().optional(),
      fileName: z.string().optional(),
      fileSize: z.number().positive().optional(),
      repliedToMessageId: z.string().uuid().optional(),
    })
    .optional(),
});

// Add reaction validation
export const addReactionSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required').max(10, 'Emoji too long'),
});

// Query parameters validation
export const getConversationsQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val) : val;
      if (isNaN(num)) throw new Error('Limit must be a valid number');
      return num;
    })
    .refine((val) => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default(50),
  offset: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val) : val;
      if (isNaN(num)) throw new Error('Offset must be a valid number');
      return num;
    })
    .refine((val) => val >= 0, 'Offset must be non-negative')
    .optional()
    .default(0),
});

export const getConversationQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val) : val;
      if (isNaN(num)) throw new Error('Limit must be a valid number');
      return num;
    })
    .refine((val) => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default(50),
  offset: z
    .union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val) : val;
      if (isNaN(num)) throw new Error('Offset must be a valid number');
      return num;
    })
    .refine((val) => val >= 0, 'Offset must be non-negative')
    .optional()
    .default(0),
  beforeMessageId: z.string().uuid().optional(),
});

// Path parameters validation
export const conversationIdSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
});

export const messageIdSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
});
