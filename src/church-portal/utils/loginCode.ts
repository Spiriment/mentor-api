import { CHURCH_PORTAL_USER_ROLE } from '../entities/churchPortalUser.entity';

export const LOGIN_CODE_EXPIRY_MINUTES = 10;
export const MAX_LOGIN_CODE_ATTEMPTS = 5;
export const MAX_LOGIN_CODES_PER_HOUR = 10;
export const LOGIN_CODE_RESEND_SECONDS = 30;

/**
 * Pastors can see members' private details, send invoices and export everyone's data. Setting
 * CHURCH_PORTAL_TWO_STEP=off is the emergency switch if email is down and pastors are locked out.
 */
export function requiresLoginCode(role: string, setting = process.env.CHURCH_PORTAL_TWO_STEP): boolean {
  if (setting?.trim().toLowerCase() === 'off') return false;
  return role === CHURCH_PORTAL_USER_ROLE.PASTOR;
}

/** Enough to recognise the address on screen, for someone who has only proved the password */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  return `${name[0]}${'*'.repeat(Math.min(Math.max(name.length - 1, 2), 6))}@${domain}`;
}
