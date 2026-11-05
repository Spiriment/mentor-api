import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maskEmail, requiresLoginCode } from './loginCode';

describe('requiresLoginCode', () => {
  it('applies to pastors only', () => {
    assert.equal(requiresLoginCode('pastor', undefined), true);
    assert.equal(requiresLoginCode('deacon', undefined), false);
    assert.equal(requiresLoginCode('leader', undefined), false);
  });

  it('can be switched off in an emergency, and only by saying off', () => {
    assert.equal(requiresLoginCode('pastor', ' OFF '), false);
    assert.equal(requiresLoginCode('pastor', 'false'), true);
    assert.equal(requiresLoginCode('pastor', ''), true);
  });
});

describe('maskEmail', () => {
  it('hides the name but keeps the domain', () => {
    assert.equal(maskEmail('pastor@church.org'), 'p*****@church.org');
    assert.equal(maskEmail('a@church.org'), 'a**@church.org');
    assert.equal(maskEmail('averyveryverylongname@church.org'), 'a******@church.org');
  });

  it('never returns an unmasked address', () => {
    assert.equal(maskEmail('not-an-email'), '***');
  });
});
