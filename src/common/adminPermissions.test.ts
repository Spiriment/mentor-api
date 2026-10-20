import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';
import { effectiveAdminPermissions, hasAdminPermission, readAdminPermissions } from './adminPermissions';

describe('admin permissions', () => {
  it('gives super admins everything, regardless of stored grants', () => {
    assert.equal(hasAdminPermission({ role: ADMIN_ROLE.SUPER_ADMIN, permissions: null }, 'church.suspend'), true);
    assert.ok(effectiveAdminPermissions({ role: ADMIN_ROLE.SUPER_ADMIN }).includes('church.remove_members'));
  });

  it('gives support admins nothing by default', () => {
    assert.equal(hasAdminPermission({ role: ADMIN_ROLE.SUPPORT, permissions: null }, 'church.suspend'), false);
    assert.deepEqual(effectiveAdminPermissions({ role: ADMIN_ROLE.SUPPORT }), []);
  });

  it('honours grants for support admins', () => {
    const admin = { role: ADMIN_ROLE.SUPPORT, permissions: ['church.suspend'] };
    assert.equal(hasAdminPermission(admin, 'church.suspend'), true);
    assert.equal(hasAdminPermission(admin, 'church.remove_members'), false);
  });

  it('drops unknown or duplicate stored values', () => {
    assert.deepEqual(readAdminPermissions(['church.suspend', 'church.suspend', 'nuke.everything', 4]), ['church.suspend']);
    assert.deepEqual(readAdminPermissions('church.suspend'), []);
  });
});
