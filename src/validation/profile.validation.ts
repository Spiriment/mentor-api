import { z } from 'zod';
import { GENDER } from '../common/constants/options';

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  gender: z
    .nativeEnum(GENDER, {
      errorMap: () => ({ message: 'Invalid gender' }),
    })
    .optional(),
  country: z.string().min(1, 'Country is required').optional(),
  countryCode: z.string().min(2, 'Country code is required').optional(),
  birthday: z.string().min(1, 'Birthday is required').optional(),
});

export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>;
