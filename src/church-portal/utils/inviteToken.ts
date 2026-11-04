import crypto from 'crypto';

export const INVITE_EXPIRY_HOURS = 48;

/**
 * Invite tokens are RS256 JWTs (600+ characters), too long for the 255-character inviteToken
 * column, so only this fingerprint is stored. It also keeps a usable link out of the database.
 */
export function hashInviteToken(inviteToken: string): string {
  return crypto.createHash('sha256').update(inviteToken).digest('hex');
}

export function inviteTokenMatches(stored: string | null | undefined, inviteToken: string): boolean {
  if (!stored) return false;
  const expected = Buffer.from(hashInviteToken(inviteToken));
  const actual = Buffer.from(stored);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** The invite email, shared by every path that sends one (admin invite, resend, forgot password) */
export function buildInviteEmail(
  user: { email: string; firstName?: string | null; lastName?: string | null; role: string },
  portal: { name: string; slug: string; joinCode?: string | null },
  inviteToken: string,
  baseUrl: string = process.env.CHURCH_PORTAL_URL || 'https://admin.spiriment.com',
) {
  const portalUrl = `${baseUrl.replace(/\/$/, '')}/church/${portal.slug}`;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return {
    to: user.email,
    subject: `You've been invited to manage ${portal.name} on Spiriment`,
    partialName: 'church-portal-invite',
    templateData: {
      name: fullName || 'Pastor',
      churchName: portal.name,
      role: user.role,
      inviteUrl: `${portalUrl}/accept-invite?token=${inviteToken}`,
      loginUrl: `${portalUrl}/login`,
      email: user.email,
      joinCode: portal.joinCode ?? null,
      expiryHours: INVITE_EXPIRY_HOURS,
    },
  };
}
