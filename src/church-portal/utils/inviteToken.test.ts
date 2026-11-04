import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInviteEmail, describeInvite, hashInviteToken, inviteTokenMatches } from './inviteToken';

const LONG_TOKEN = `header.payload.${'s'.repeat(640)}`;

describe('invite token storage', () => {
  it('fits the 255-character column whatever the token length', () => {
    assert.ok(LONG_TOKEN.length > 255);
    assert.ok(hashInviteToken(LONG_TOKEN).length <= 255);
  });

  it('matches the token it was made from', () => {
    assert.equal(inviteTokenMatches(hashInviteToken(LONG_TOKEN), LONG_TOKEN), true);
  });

  it('rejects another token, a missing value, and a value cut off by the old column', () => {
    assert.equal(inviteTokenMatches(hashInviteToken('other'), LONG_TOKEN), false);
    assert.equal(inviteTokenMatches(null, LONG_TOKEN), false);
    assert.equal(inviteTokenMatches(LONG_TOKEN.slice(0, 255), LONG_TOKEN), false);
  });
});

describe('buildInviteEmail', () => {
  const portal = { name: 'Secret Place', slug: 'secret-place', joinCode: 'ABC123' };
  const user = { email: 'pastor@example.com', firstName: 'Apostle', lastName: 'Emmanuel', role: 'pastor' };

  it('greets by full name and includes the links and join code', () => {
    const { templateData } = buildInviteEmail(user, portal, 'tok', 'https://portal.test/');
    assert.equal(templateData.name, 'Apostle Emmanuel');
    assert.equal(templateData.inviteUrl, 'https://portal.test/church/secret-place/accept-invite?token=tok');
    assert.equal(templateData.loginUrl, 'https://portal.test/church/secret-place/login');
    assert.equal(templateData.email, 'pastor@example.com');
    assert.equal(templateData.joinCode, 'ABC123');
    assert.equal(templateData.expiryHours, 48);
  });

  it('falls back when the name or join code is missing', () => {
    const { templateData } = buildInviteEmail(
      { email: 'p@example.com', role: 'pastor' },
      { name: 'Grace', slug: 'grace' },
      'tok',
    );
    assert.equal(templateData.name, 'Pastor');
    assert.equal(templateData.joinCode, null);
  });
});

describe('describeInvite', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const later = new Date('2026-11-05T12:00:00Z');
  const earlier = new Date('2026-11-03T12:00:00Z');
  const token = hashInviteToken('tok');

  it('is pending until the link expires, and works out when it was sent', () => {
    const result = describeInvite({ isActive: false, inviteToken: token, inviteTokenExpiresAt: later }, now);
    assert.equal(result.inviteStatus, 'pending');
    assert.equal(result.inviteSentAt?.toISOString(), '2026-11-03T12:00:00.000Z');
  });

  it('is expired after that', () => {
    const result = describeInvite({ isActive: false, inviteToken: token, inviteTokenExpiresAt: earlier }, now);
    assert.equal(result.inviteStatus, 'expired');
  });

  it('treats a token cut off by the old column as expired, since the link cannot work', () => {
    const result = describeInvite({ isActive: false, inviteToken: 'x'.repeat(255), inviteTokenExpiresAt: later }, now);
    assert.equal(result.inviteStatus, 'expired');
  });

  it('is accepted or deactivated once a password is set, ignoring reset codes', () => {
    const resetCode = { inviteToken: '$2a$10$hash', inviteTokenExpiresAt: later };
    assert.equal(describeInvite({ password: 'x', isActive: true, ...resetCode }, now).inviteStatus, 'accepted');
    assert.equal(describeInvite({ password: 'x', isActive: false, ...resetCode }, now).inviteStatus, 'deactivated');
    assert.equal(describeInvite({ password: 'x', isActive: true, ...resetCode }, now).inviteSentAt, null);
  });
});
