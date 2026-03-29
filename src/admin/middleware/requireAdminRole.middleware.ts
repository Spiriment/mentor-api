import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@/common';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';

export function requireAdminRole(...allowed: ADMIN_ROLE[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new ForbiddenError('Admin authentication required'));
    }
    if (!allowed.includes(req.admin.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}
