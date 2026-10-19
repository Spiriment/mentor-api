import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redactSensitive } from './redactSensitive';

describe('redactSensitive', () => {
  it('masks credentials but keeps useful context', () => {
    const out = redactSensitive({
      email: 'a@b.com',
      password: 'hunter2',
      idToken: 'eyJ...',
      otp: '123456',
      newPassword: 'x',
      profile: { refreshToken: 'r', firstName: 'Ada' },
      keys: { p256dh: 'k', auth: 'a' },
      code: '999',
      sessionCode: 'kept',
    }) as any;
    assert.equal(out.email, 'a@b.com');
    assert.equal(out.profile.firstName, 'Ada');
    for (const v of [out.password, out.idToken, out.otp, out.newPassword, out.profile.refreshToken, out.keys.p256dh, out.keys.auth, out.code]) {
      assert.equal(v, '[redacted]');
    }
    assert.equal(out.sessionCode, 'kept');
  });

  it('passes through non-objects untouched', () => {
    assert.equal(redactSensitive('plain'), 'plain');
    assert.equal(redactSensitive(undefined), undefined);
  });
});
