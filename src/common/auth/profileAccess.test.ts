import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessProfile } from './profileAccess';
import { isWithinExpiryGrace } from './jwt';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const req = (viewer: { id: string; role?: string }, method: string, path: string, targetUserId = OTHER) => ({
  viewer,
  targetUserId,
  method,
  path,
});

describe('canAccessProfile', () => {
  it('lets anyone use their own profile routes', () => {
    for (const kind of ['mentor', 'mentee'] as const) {
      assert.equal(canAccessProfile(kind, req({ id: ME, role: 'mentee' }, 'PUT', `/${ME}/profile-image`, ME)), true);
      assert.equal(canAccessProfile(kind, req({ id: ME }, 'GET', `/${ME}`, ME)), true);
    }
  });

  it("never lets anyone change someone else's profile", () => {
    for (const kind of ['mentor', 'mentee'] as const) {
      for (const role of ['mentor', 'mentee']) {
        assert.equal(canAccessProfile(kind, req({ id: ME, role }, 'PUT', `/${OTHER}/profile-image`)), false);
        assert.equal(canAccessProfile(kind, req({ id: ME, role }, 'POST', `/${OTHER}/complete-onboarding`)), false);
        assert.equal(canAccessProfile(kind, req({ id: ME, role }, 'POST', `/${OTHER}/accept-agreement`)), false);
      }
    }
  });

  it('lets mentors read a mentee profile, and nothing else of it', () => {
    assert.equal(canAccessProfile('mentee', req({ id: ME, role: 'mentor' }, 'GET', `/${OTHER}`)), true);
    assert.equal(canAccessProfile('mentee', req({ id: ME, role: 'mentor' }, 'GET', `/${OTHER}/`)), true);
    assert.equal(canAccessProfile('mentee', req({ id: ME, role: 'mentor' }, 'GET', `/${OTHER}/onboarding-progress`)), false);
    assert.equal(canAccessProfile('mentee', req({ id: ME, role: 'mentee' }, 'GET', `/${OTHER}`)), false);
  });

  it("keeps mentor profiles to their owner (others use /api/mentors)", () => {
    assert.equal(canAccessProfile('mentor', req({ id: ME, role: 'mentee' }, 'GET', `/${OTHER}`)), false);
    assert.equal(canAccessProfile('mentor', req({ id: ME, role: 'mentor' }, 'GET', `/${OTHER}`)), false);
  });
});

describe('isWithinExpiryGrace', () => {
  const now = 1_800_000_000;
  it('accepts unexpired and recently expired tokens', () => {
    assert.equal(isWithinExpiryGrace(now + 60, now, 100), true);
    assert.equal(isWithinExpiryGrace(now - 99, now, 100), true);
  });
  it('rejects tokens past the grace period or without an expiry', () => {
    assert.equal(isWithinExpiryGrace(now - 100, now, 100), false);
    assert.equal(isWithinExpiryGrace(undefined, now, 100), false);
    assert.equal(isWithinExpiryGrace('soon', now, 100), false);
  });
});
