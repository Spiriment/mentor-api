import { Request, Response, NextFunction } from 'express';
import { jwt } from '@/config/int-services';
import { AppDataSource } from '@/config/data-source';
import { ChurchPortalUser } from '../entities/churchPortalUser.entity';
import { ChurchPortal, CHURCH_PORTAL_STATUS } from '../entities/churchPortal.entity';

export const PORTAL_SUSPENDED_MESSAGE = 'This church portal is suspended. Contact Spiriment support.';
import { UnauthorizedError } from '@/common/errors';

declare global {
  namespace Express {
    interface Request {
      churchPortalUser?: ChurchPortalUser;
    }
  }
}

export async function churchPortalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verifyChurchPortalAccessToken(token);

    const repo = AppDataSource.getRepository(ChurchPortalUser);
    const portalUser = await repo.findOne({
      where: { id: decoded.portalUserId, churchPortalId: decoded.churchPortalId },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'churchPortalId'],
    });

    if (!portalUser || !portalUser.isActive) {
      throw new UnauthorizedError('Invalid or inactive church portal account');
    }

    // Suspension takes effect on the next request, not when the token runs out
    const portalActive = await AppDataSource.getRepository(ChurchPortal).exist({
      where: { id: portalUser.churchPortalId, status: CHURCH_PORTAL_STATUS.ACTIVE },
    });
    if (!portalActive) {
      throw new UnauthorizedError(PORTAL_SUSPENDED_MESSAGE);
    }

    req.churchPortalUser = portalUser;
    next();
  } catch (err) {
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError('Invalid token'));
  }
}
