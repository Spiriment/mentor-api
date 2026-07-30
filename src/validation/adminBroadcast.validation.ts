import { z } from 'zod';
import {
  EmailCampaignAudienceType,
  EmailCampaignStatus,
} from '@/database/entities/emailCampaign.entity';
import { EmailCampaignRecipientStatus } from '@/database/entities/emailCampaignRecipient.entity';

export const adminBroadcastListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(EmailCampaignStatus).optional(),
  templatesOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const adminBroadcastCreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  htmlContent: z.string().min(1),
  audienceType: z.nativeEnum(EmailCampaignAudienceType),
  audienceConfig: z
    .object({
      role: z.enum(['mentor', 'mentee', 'all']).optional(),
      emails: z.array(z.string().email()).optional(),
      requireVerified: z.boolean().optional(),
    })
    .optional(),
  replyTo: z.string().email().optional(),
  scheduledAt: z.string().min(1).optional().nullable(),
});

export const adminBroadcastUpdateBodySchema = adminBroadcastCreateBodySchema.partial();

export const adminBroadcastScheduleBodySchema = z.object({
  scheduledAt: z.string().min(1),
});

export const adminBroadcastSaveTemplateBodySchema = z.object({
  templateName: z.string().min(1).max(255),
});

export const adminBroadcastSendTestBodySchema = z.object({
  email: z.string().email(),
});

export const adminBroadcastRecipientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(EmailCampaignRecipientStatus).optional(),
});
