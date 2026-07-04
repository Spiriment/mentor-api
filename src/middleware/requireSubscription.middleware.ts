import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppDataSource } from '@/config/data-source';
import { UserSubscription, SubscriptionTier, SubscriptionStatus } from '@/database/entities/userSubscription.entity';
import { AppError } from '@/common';

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, none: 0, basic: 1, pro: 2, premium: 3 };
const ACCESS_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due'];

export const requireSubscription = (minTier: SubscriptionTier) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', StatusCodes.UNAUTHORIZED));
    }

    const sub = await AppDataSource.getRepository(UserSubscription).findOne({
      where: { user: { id: req.user.id } },
    });

    const activeTier: SubscriptionTier =
      sub && ACCESS_STATUSES.includes(sub.status) ? sub.tier : 'none';

    if (TIER_RANK[activeTier] < TIER_RANK[minTier]) {
      return next(
        new AppError(
          `This feature requires a ${minTier} subscription or higher.`,
          StatusCodes.PAYMENT_REQUIRED,
          'SUBSCRIPTION_REQUIRED'
        )
      );
    }

    next();
  };
};
