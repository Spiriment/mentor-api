import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@/common';
import { AppDataSource } from '@/config/data-source';
import { AdminUser } from '@/database/entities/adminUser.entity';
import { ADMIN_PERMISSIONS, hasAdminPermission, type AdminPermission } from '@/common/adminPermissions';

/**
 * Allow super admins, and support admins granted `permission`. Grants are read from the
 * database on each call, so granting or revoking applies immediately (no re-login).
 */
export async function assertAdminPermission(req: Request, permission: AdminPermission): Promise<void> {
  if (!req.admin) throw new ForbiddenError('Admin authentication required');
  const admin = await AppDataSource.getRepository(AdminUser).findOne({
    where: { id: req.admin.id, isActive: true },
    select: ['id', 'role', 'permissions'],
  });
  if (!admin || !hasAdminPermission(admin, permission)) {
    throw new ForbiddenError(`You don't have permission to ${ADMIN_PERMISSIONS[permission].label.toLowerCase()}.`);
  }
}

export function requireAdminPermission(permission: AdminPermission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    assertAdminPermission(req, permission).then(() => next(), next);
  };
}
