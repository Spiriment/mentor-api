import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2).max(100),
  lastName: z.string().min(2).max(100),
  role: z.string().min(2).max(100),
  clientId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  role: z.string().min(2).max(100).optional(),
  clientId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.string().min(2).max(100),
});

export const UserFiltersSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  role: z.string().min(2).max(100).optional(),
  clientId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const verifyNinSchema = z.object({
  nin: z
    .string()
    .length(11, "NIN must be exactly 11 digits")
    .regex(/^\d{11}$/, "NIN must contain only digits"),
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters"),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters"),
  selfieImage: z
    .string()
    .min(1, "Selfie image is required")
    .max(50 * 1024 * 1024, "Selfie image size must be less than 50MB")
    .regex(
      /^data:image\/(jpeg|jpg|png);base64,/,
      "Selfie image must be a valid base64 image"
    ),
});

export type VerifyNinDTO = z.infer<typeof verifyNinSchema>;

export const verifyBvnSchema = z.object({
  bvn: z
    .string()
    .length(11, "BVN must be exactly 11 digits")
    .regex(/^\d{11}$/, "BVN must contain only digits"),
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters")
    .optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in DD-MM-YYYY format")
    .optional(),
});

export type VerifyBvnDTO = z.infer<typeof verifyBvnSchema>;

export const submitExecutiveRequestSchema = z.object({
  educationDocumentBase64: z
    .string()
    .min(1, "Education document is required")
    .base64("Invalid document base64")
    .optional(),
});

export type SubmitExecutiveRequestDTO = z.infer<
  typeof submitExecutiveRequestSchema
>;
