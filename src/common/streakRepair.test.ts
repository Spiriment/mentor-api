import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { repairStreak, type StreakState } from './streakRepair';

const base = (o: Partial<StreakState> = {}): StreakState => ({
  currentStreak: 0,
  longestStreak: 0,
  lastStreakDate: null,
  monthlyStreakData: {},
  weeklyStreakData: [false, false, false, false, false, false, false],
  ...o,
});

describe('repairStreak', () => {
  it('restores a streak reset by the outage (read Fri–Mon, Sat evening + Sun lost)', () => {
    // Recorded: Thu 15, Fri 16, (Sat 17 lost), (Sun 18 lost), Mon 19 → reset to 1
    const state = base({
      currentStreak: 1,
      longestStreak: 2,
      lastStreakDate: '2026-10-19',
      monthlyStreakData: { '2026-10': [15, 16, 19] },
    });
    const r = repairStreak(state, ['2026-10-17', '2026-10-18'], '2026-10-19');
    assert.equal(r.changed, true);
    assert.deepEqual(r.addedDays, ['2026-10-17', '2026-10-18']);
    assert.equal(r.next.currentStreak, 5);
    assert.equal(r.next.longestStreak, 5);
    assert.deepEqual(r.next.monthlyStreakData['2026-10'], [15, 16, 17, 18, 19]);
    // Week of Sun 18: Sun + Mon read
    assert.deepEqual(r.next.weeklyStreakData, [true, true, false, false, false, false, false]);
  });

  it('never lowers a streak (e.g. one bridged by a freeze)', () => {
    const state = base({
      currentStreak: 12,
      longestStreak: 12,
      lastStreakDate: '2026-10-17',
      monthlyStreakData: { '2026-10': [16, 17] },
    });
    const r = repairStreak(state, ['2026-10-18'], '2026-10-18');
    assert.equal(r.next.currentStreak, 12);
    assert.equal(r.next.lastStreakDate, '2026-10-18');
  });

  it('is idempotent and ignores days already recorded', () => {
    const state = base({ currentStreak: 3, lastStreakDate: '2026-10-18', monthlyStreakData: { '2026-10': [16, 17, 18] } });
    assert.equal(repairStreak(state, ['2026-10-17', '2026-10-18'], '2026-10-19').changed, false);
  });

  it('crosses month boundaries', () => {
    const state = base({ currentStreak: 1, monthlyStreakData: { '2026-09': [30] } });
    const r = repairStreak(state, ['2026-10-01'], '2026-10-01');
    assert.equal(r.next.currentStreak, 2);
  });
});
