import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADMIN_ROLE } from './constants/adminRoles';
import { channelsFor, resolvePreferences } from './adminAlerts';

const superAdmin = { role: ADMIN_ROLE.SUPER_ADMIN, isActive: true };
const support = { role: ADMIN_ROLE.SUPPORT, isActive: true };

describe('channelsFor', () => {
  it('uses defaults when nothing is stored', () => {
    assert.deepEqual(channelsFor(superAdmin, 'support_ticket'), ['push', 'bell']);
    assert.deepEqual(channelsFor(superAdmin, 'mentor_application'), ['push']);
  });

  it('never sends billing events to support admins', () => {
    const optedIn = {
      ...support,
      notificationPreferences: { subscription: { push: true, email: true, bell: true } },
    };
    assert.deepEqual(channelsFor(optedIn, 'subscription'), []);
  });

  it('respects stored choices', () => {
    const admin = {
      ...superAdmin,
      notificationPreferences: { support_ticket: { push: false, email: true, bell: false } },
    };
    assert.deepEqual(channelsFor(admin, 'support_ticket'), ['email']);
  });

  it('skips deactivated admins', () => {
    assert.deepEqual(channelsFor({ ...superAdmin, isActive: false }, 'support_ticket'), []);
  });
});

describe('resolvePreferences', () => {
  it('ignores junk and forces bell off where the bell already lists the event', () => {
    const prefs = resolvePreferences({
      mentor_application: { bell: true, push: 'yes' },
      unknown_event: { push: true },
    });
    assert.equal(prefs.mentor_application.bell, false);
    assert.equal(prefs.mentor_application.push, true); // invalid value → default
    assert.equal((prefs as any).unknown_event, undefined);
  });
});
