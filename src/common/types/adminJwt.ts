import { ADMIN_ROLE } from '../constants/adminRoles';

export const ADMIN_JWT_TYP = 'admin' as const;
export const ADMIN_REFRESH_JWT_TYP = 'admin_refresh' as const;

export type AdminAccessJwtPayload = {
  typ: typeof ADMIN_JWT_TYP;
  adminId: string;
  email: string;
  adminRole: ADMIN_ROLE;
};

export type AdminRefreshJwtPayload = {
  typ: typeof ADMIN_REFRESH_JWT_TYP;
  adminId: string;
};

export type DecodedAdminAccessToken = AdminAccessJwtPayload & {
  iat: number;
  exp: number;
};

export type DecodedAdminRefreshToken = AdminRefreshJwtPayload & {
  iat: number;
  exp: number;
};
