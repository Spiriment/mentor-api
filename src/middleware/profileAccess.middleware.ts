import { Request, Response, NextFunction, RequestParamHandler } from 'express';
import { jwt } from '../config/int-services';
import { AppDataSource } from '../config/data-source';
import { User } from '../database/entities/user.entity';
import { AppError, ForbiddenError } from '../common/errors';
import { StatusCodes } from 'http-status-codes';
import { AUTH_USER_SELECT } from './auth.middleware';
import { PROFILE_TOKEN_GRACE_SECONDS, canAccessProfile } from '../common/auth/profileAccess';

/**
 * authenticateToken for the profile routes: the same checks (valid signature, active account),
 * except a token that expired within PROFILE_TOKEN_GRACE_SECONDS is still accepted, because
 * older app builds don't refresh tokens on these routes.
 */
export const authenticateProfileRequest = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Access token required', StatusCodes.UNAUTHORIZED, 'MISSING_TOKEN');
    }

    const decoded = jwt.verifyAllowingRecentExpiry(token, PROFILE_TOKEN_GRACE_SECONDS) as any;
    if (!decoded?.userId) {
      throw new AppError('Invalid token', StatusCodes.UNAUTHORIZED, 'INVALID_TOKEN');
    }

    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: decoded.userId },
      select: AUTH_USER_SELECT,
    });
    if (!user) {
      throw new AppError('User not found', StatusCodes.UNAUTHORIZED, 'USER_NOT_FOUND');
    }
    if (!user.isActive) {
      throw new AppError('Account is deactivated', StatusCodes.UNAUTHORIZED, 'ACCOUNT_DEACTIVATED');
    }
    if (['suspended', 'deleted', 'blocked'].includes(String(user.accountStatus))) {
      throw new AppError('Account is not available', StatusCodes.UNAUTHORIZED, 'ACCOUNT_UNAVAILABLE');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/** router.param('userId', ...) guard: may the signed-in user use this profile route? */
export const profileAccessGuard =
  (kind: 'mentor' | 'mentee'): RequestParamHandler =>
  (req, _res, next, userId) => {
    if (!req.user) return next(new AppError('Authentication required', StatusCodes.UNAUTHORIZED));
    const allowed = canAccessProfile(kind, {
      viewer: { id: req.user.id, role: req.user.role },
      targetUserId: String(userId),
      method: req.method,
      path: req.path,
    });
    return allowed ? next() : next(new ForbiddenError("You can't access this profile"));
  };
