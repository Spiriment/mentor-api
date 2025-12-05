import { Request, Response, NextFunction } from 'express';
import { jwt } from '../config/int-services';
import { AppDataSource } from '../config/data-source';
import { User } from '../database/entities/user.entity';
import { AppError } from '../common/errors';
import { StatusCodes } from 'http-status-codes';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AppError(
        'Access token required',
        StatusCodes.UNAUTHORIZED,
        'MISSING_TOKEN'
      );
    }

    // Verify token
    const decoded = jwt.verify(token) as any;

    if (!decoded || !decoded.userId) {
      throw new AppError(
        'Invalid token',
        StatusCodes.UNAUTHORIZED,
        'INVALID_TOKEN'
      );
    }

    // Get user from database
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: decoded.userId },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'gender',
        'country',
        'countryCode',
        'birthday',
        'role',
        'isOnboardingComplete',
        'isActive',
        'accountStatus',
        'currentStreak',
        'longestStreak',
        'lastStreakDate',
        'weeklyStreakData',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!user) {
      throw new AppError(
        'User not found',
        StatusCodes.NOT_FOUND,
        'USER_NOT_FOUND'
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'Account is deactivated',
        StatusCodes.UNAUTHORIZED,
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Update last active timestamp (async, don't block the request)
    userRepository
      .update(user.id, { lastActiveAt: new Date() })
      .catch((err) => {
        console.error('Error updating lastActiveAt:', err);
      });

    // Add user to request object
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(
        new AppError('Invalid token', StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN')
      );
    }

    if (error.name === 'TokenExpiredError') {
      return next(
        new AppError('Token expired', StatusCodes.UNAUTHORIZED, 'TOKEN_EXPIRED')
      );
    }

    next(error);
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError(
          'Authentication required',
          StatusCodes.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        )
      );
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          'Insufficient permissions',
          StatusCodes.FORBIDDEN,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
};
