import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertCanChangeTeamMember } from './teamRules';

describe('assertCanChangeTeamMember', () => {
  it('lets a pastor change someone else', () => {
    assert.doesNotThrow(() => assertCanChangeTeamMember('a', 'b', Error));
  });

  it('stops a pastor changing themselves', () => {
    assert.throws(() => assertCanChangeTeamMember('a', 'a', Error), /your own role or access/);
  });
});
