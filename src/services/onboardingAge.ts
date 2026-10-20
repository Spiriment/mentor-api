import { StatusCodes } from 'http-status-codes';
import { AppDataSource } from '@/config/data-source';
import { AppError } from '@/common/errors';
import { User } from '@/database/entities/user.entity';
import { onboardingAgeProblem } from '@/common/constants/userAge';

/** Block finishing onboarding (mentee or mentor) without a birthday showing the user is 15+. */
export async function assertOldEnoughToOnboard(userId: string): Promise<void> {
  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: userId },
    select: ['id', 'birthday'],
  });
  const problem = onboardingAgeProblem(user?.birthday);
  if (problem) {
    throw new AppError(
      problem,
      StatusCodes.BAD_REQUEST,
      user?.birthday ? 'UNDER_MINIMUM_AGE' : 'BIRTHDAY_REQUIRED',
    );
  }
}
