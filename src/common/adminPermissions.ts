import { ADMIN_ROLE } from '@/common/constants/adminRoles';

/**
 * Extra powers a super admin can grant to individual support admins (admin_users.permissions).
 * Super admins always have all of them; support admins have none until granted.
 * Add new ones here; the admin portal lists them from GET /admin/admin-users/permissions.
 */
export const ADMIN_PERMISSIONS = {
  'church.suspend': {
    label: 'Suspend and reactivate churches',
    description: "Signs a church's pastors out and ends members' church discount until reactivated.",
  },
  'church.remove_members': {
    label: 'Remove members from a church',
    description: 'Ends their church discount and any plan the church pays for.',
  },
} as const;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

export const isAdminPermission = (value: unknown): value is AdminPermission =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(ADMIN_PERMISSIONS, value);

/** Stored grants, keeping only permissions that still exist */
export function readAdminPermissions(stored: unknown): AdminPermission[] {
  return Array.isArray(stored) ? Array.from(new Set(stored.filter(isAdminPermission))) : [];
}

/** What an admin can actually do: everything for super admins, their grants for support */
export function effectiveAdminPermissions(admin: { role: ADMIN_ROLE | string; permissions?: unknown }): AdminPermission[] {
  if (admin.role === ADMIN_ROLE.SUPER_ADMIN) return Object.keys(ADMIN_PERMISSIONS) as AdminPermission[];
  return readAdminPermissions(admin.permissions);
}

export function hasAdminPermission(
  admin: { role: ADMIN_ROLE | string; permissions?: unknown },
  permission: AdminPermission,
): boolean {
  return effectiveAdminPermissions(admin).includes(permission);
}
