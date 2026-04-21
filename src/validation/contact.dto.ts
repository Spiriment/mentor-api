import { z } from 'zod';
import { ContactType } from '../database/entities/contactMessage.entity';

export const contactValidationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  type: z.nativeEnum(ContactType).optional().default(ContactType.GENERAL),
  partnershipType: z.string().optional().nullable(),
  skill: z.string().optional().nullable(),
  portfolioLink: z.string().optional().nullable(),
});

export type ContactDTO = z.infer<typeof contactValidationSchema>;
