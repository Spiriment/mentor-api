import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { menteeChurchInfoProblem } from './onboardingRules';

describe('menteeChurchInfoProblem', () => {
  it('requires both denomination and church name', () => {
    assert.ok(menteeChurchInfoProblem({}));
    assert.ok(menteeChurchInfoProblem({ churchDenomination: 'Baptist', churchName: '' }));
    assert.ok(menteeChurchInfoProblem({ churchDenomination: '   ', churchName: 'Grace Church' }));
  });

  it('accepts a real church and the "no church yet" answer', () => {
    assert.equal(menteeChurchInfoProblem({ churchDenomination: 'Baptist', churchName: 'Grace Church' }), null);
    assert.equal(menteeChurchInfoProblem({ churchDenomination: 'None', churchName: 'Not attending a church yet' }), null);
  });
});
