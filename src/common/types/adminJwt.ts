import { ADMIN_ROLE } from '../constants/adminRoles';

export const ADMIN_JWT_TYP = 'admin' as const;
export const ADMIN_REFRESH_JWT_TYP = 'admin_refresh' as const;

export const CHURCH_PORTAL_JWT_TYP = 'church_portal' as const;
export const CHURCH_PORTAL_REFRESH_JWT_TYP = 'church_portal_refresh' as const;
export const CHURCH_PORTAL_INVITE_JWT_TYP = 'church_portal_invite' as const;

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

export type ChurchPortalAccessJwtPayload = {
  typ: typeof CHURCH_PORTAL_JWT_TYP;
  portalUserId: string;
  churchPortalId: string;
  email: string;
  role: string;
};

export type ChurchPortalRefreshJwtPayload = {
  typ: typeof CHURCH_PORTAL_REFRESH_JWT_TYP;
  portalUserId: string;
};

export type ChurchPortalInviteJwtPayload = {
  typ: typeof CHURCH_PORTAL_INVITE_JWT_TYP;
  portalUserId: string;
  churchPortalId: string;
  email: string;
};

export type DecodedChurchPortalAccessToken = ChurchPortalAccessJwtPayload & { iat: number; exp: number };
export type DecodedChurchPortalRefreshToken = ChurchPortalRefreshJwtPayload & { iat: number; exp: number };
export type DecodedChurchPortalInviteToken = ChurchPortalInviteJwtPayload & { iat: number; exp: number };
