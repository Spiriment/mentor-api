import { Request, Response, NextFunction } from 'express';
import { JwtService, UnauthorizedError } from '@/common';
import { AppDataSource } from '@/config/data-source';
import { AdminUser } from '@/database/entities/adminUser.entity';

export function createAdminAuthMiddleware(jwt: JwtService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      const decoded = jwt.verifyAdminAccessToken(token);
      const repo = AppDataSource.getRepository(AdminUser);
      const admin = await repo.findOne({
        where: { id: decoded.adminId },
        select: ['id', 'email', 'role', 'isActive'],
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedError('Invalid or inactive admin account');
      }

      if (admin.role !== decoded.adminRole || admin.email !== decoded.email) {
        throw new UnauthorizedError('Token no longer valid');
      }

      req.admin = admin;
      next();
    } catch (err) {
      next(err instanceof UnauthorizedError ? err : new UnauthorizedError('Invalid token'));
    }
  };
}
