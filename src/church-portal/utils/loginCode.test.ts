import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { maskEmail, requiresLoginCode } from './loginCode';

describe('requiresLoginCode', () => {
  it('is on unless it has been switched off', () => {
    assert.equal(requiresLoginCode(undefined), true);
  });

  it('can be switched off in an emergency, and only by saying off', () => {
    assert.equal(requiresLoginCode(' OFF '), false);
    assert.equal(requiresLoginCode('false'), true);
    assert.equal(requiresLoginCode(''), true);
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
