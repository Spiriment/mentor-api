import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assignRanks,
  isValidQuizVersion,
  leaderboardDisplayName,
  MAX_QUIZ_QUESTIONS,
  normalizeAttemptNumbers,
} from './quizLeaderboard';

const now = new Date('2026-11-25T12:00:00Z');

describe('normalizeAttemptNumbers', () => {
  it('keeps a genuine attempt as it is', () => {
    const r = normalizeAttemptNumbers({ score: 7, total: 10, completedAt: '2026-11-25T11:00:00Z' }, 40, now);
    assert.deepEqual(r, { score: 7, total: 10, completedAt: new Date('2026-11-25T11:00:00Z') });
  });

  it('caps an inflated score at the questions in one quiz', () => {
    const r = normalizeAttemptNumbers({ score: 100000, total: 100000, completedAt: now.toISOString() }, 40, now);
    assert.equal(r.total, MAX_QUIZ_QUESTIONS);
    assert.equal(r.score, MAX_QUIZ_QUESTIONS);
  });

  it('never lets the score exceed the total', () => {
    assert.equal(normalizeAttemptNumbers({ score: 9, total: 5, completedAt: now }, 40, now).score, 5);
  });

  it('uses the book size when a level has fewer than 10 questions', () => {
    const r = normalizeAttemptNumbers({ score: 10, total: 10, completedAt: now }, 6, now);
    assert.deepEqual([r.score, r.total], [6, 6]);
  });

  it('handles negative, fractional and junk numbers', () => {
    assert.deepEqual(
      [normalizeAttemptNumbers({ score: -3, total: 'x', completedAt: now }, 40, now).score,
       normalizeAttemptNumbers({ score: 4.9, total: 10, completedAt: now }, 40, now).score],
      [0, 4],
    );
  });

  it('treats a future or missing date as now, and keeps an old offline one', () => {
    assert.deepEqual(normalizeAttemptNumbers({ score: 1, total: 10, completedAt: '2030-01-01T00:00:00Z' }, 40, now).completedAt, now);
    assert.deepEqual(normalizeAttemptNumbers({ score: 1, total: 10, completedAt: undefined }, 40, now).completedAt, now);
    const twoMinutesAhead = new Date(now.getTime() + 2 * 60 * 1000);
    assert.deepEqual(normalizeAttemptNumbers({ score: 1, total: 10, completedAt: twoMinutesAhead.toISOString() }, 40, now).completedAt, twoMinutesAhead);
    assert.deepEqual(
      normalizeAttemptNumbers({ score: 1, total: 10, completedAt: '2026-11-01T08:00:00Z' }, 40, now).completedAt,
      new Date('2026-11-01T08:00:00Z'),
    );
  });
});

describe('isValidQuizVersion', () => {
  it('accepts levels 1 to 4 only', () => {
    assert.deepEqual([0, 1, 4, 5, 2.5, '2', NaN].map(isValidQuizVersion), [false, true, true, false, false, false, false]);
  });
});

describe('leaderboardDisplayName', () => {
  it('shows first name and last initial', () => {
    assert.equal(leaderboardDisplayName('Olawore', 'ahmad'), 'Olawore A.');
    assert.equal(leaderboardDisplayName('  Grace ', ''), 'Grace');
    assert.equal(leaderboardDisplayName(null, 'Smith'), 'S.');
    assert.equal(leaderboardDisplayName(null, null), 'Member');
  });
});

describe('assignRanks', () => {
  it('gives equal XP the same rank', () => {
    const ranked = assignRanks([{ xp: 30 }, { xp: 20 }, { xp: 20 }, { xp: 5 }]);
    assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 2, 4]);
  });
});
