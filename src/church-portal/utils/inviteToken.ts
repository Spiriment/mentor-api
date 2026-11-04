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

export type InviteStatus = 'pending' | 'expired' | 'accepted' | 'deactivated';

/**
 * Where an invite stands. An account with a password has accepted; its token fields then only
 * ever hold password-reset codes, so they say nothing about the invite. A stored value that isn't
 * a fingerprint is from before hashInviteToken: that link can't work, so it counts as expired.
 */
export function describeInvite(
  user: {
    password?: string | null;
    isActive: boolean;
    inviteToken?: string | null;
    inviteTokenExpiresAt?: Date | null;
  },
  now: Date = new Date(),
): { inviteStatus: InviteStatus; inviteSentAt: Date | null; inviteExpiresAt: Date | null } {
  if (user.password) {
    return { inviteStatus: user.isActive ? 'accepted' : 'deactivated', inviteSentAt: null, inviteExpiresAt: null };
  }
  const expiresAt = user.inviteTokenExpiresAt ? new Date(user.inviteTokenExpiresAt) : null;
  const usable = /^[a-f0-9]{64}$/.test(user.inviteToken ?? '') && !!expiresAt && expiresAt > now;
  return {
    inviteStatus: usable ? 'pending' : 'expired',
    inviteSentAt: expiresAt ? new Date(expiresAt.getTime() - INVITE_EXPIRY_HOURS * 60 * 60 * 1000) : null,
    inviteExpiresAt: expiresAt,
  };
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
