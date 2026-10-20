import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { onboardingAgeProblem } from './userAge';

const birthdayYearsAgo = (years: number, dayOffset = 0) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return d;
};

describe('onboardingAgeProblem (minimum age 15)', () => {
  it('requires a birthday', () => {
    assert.match(onboardingAgeProblem(null)!, /date of birth/);
    assert.match(onboardingAgeProblem('not a date')!, /date of birth/);
  });

  it('blocks anyone under 15, including the day before their 15th birthday', () => {
    assert.match(onboardingAgeProblem(birthdayYearsAgo(14))!, /at least 15/);
    assert.match(onboardingAgeProblem(birthdayYearsAgo(15, 1))!, /at least 15/);
  });

  it('allows 15 and older', () => {
    assert.equal(onboardingAgeProblem(birthdayYearsAgo(15)), null);
    assert.equal(onboardingAgeProblem(birthdayYearsAgo(40)), null);
  });
});
