export const LOGIN_CODE_EXPIRY_MINUTES = 10;
export const MAX_LOGIN_CODE_ATTEMPTS = 5;
export const MAX_LOGIN_CODES_PER_HOUR = 10;
export const LOGIN_CODE_RESEND_SECONDS = 30;

/**
 * Every portal role can see members' details, so everyone signs in with a code. Setting
 * CHURCH_PORTAL_TWO_STEP=off is the emergency switch if email is down and the team is locked out.
 */
export function requiresLoginCode(setting = process.env.CHURCH_PORTAL_TWO_STEP): boolean {
  return setting?.trim().toLowerCase() !== 'off';
}

/** Enough to recognise the address on screen, for someone who has only proved the password */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  return `${name[0]}${'*'.repeat(Math.min(Math.max(name.length - 1, 2), 6))}@${domain}`;
}
