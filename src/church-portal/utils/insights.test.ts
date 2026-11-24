import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  growthByMonth,
  lastMonths,
  lastWeekStarts,
  memberHealth,
  readingByWeek,
  sessionsByWeek,
  weekStartUtc,
} from './insights';

const NOW = new Date('2026-11-25T15:00:00Z'); // a Wednesday

test('weeks start on Monday (UTC)', () => {
  assert.equal(weekStartUtc(NOW).toISOString().slice(0, 10), '2026-11-23');
  assert.equal(weekStartUtc(new Date('2026-11-29T23:00:00Z')).toISOString().slice(0, 10), '2026-11-23'); // Sunday
  assert.equal(weekStartUtc(new Date('2026-11-30T00:30:00Z')).toISOString().slice(0, 10), '2026-11-30'); // Monday
});

test('lastWeekStarts / lastMonths end with the current period, oldest first', () => {
  assert.deepEqual(lastWeekStarts(3, NOW), ['2026-11-09', '2026-11-16', '2026-11-23']);
  assert.deepEqual(lastMonths(3, NOW), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(lastMonths(2, new Date('2026-01-10T00:00:00Z')), ['2025-12', '2026-01']);
});

test('sessionsByWeek counts completed vs cancelled (no-show = cancelled), ignores upcoming and out-of-range', () => {
  const weeks = lastWeekStarts(2, NOW); // 16 Nov, 23 Nov
  const rows = sessionsByWeek(
    [
      { scheduledAt: '2026-11-17T10:00:00Z', status: 'completed' },
      { scheduledAt: '2026-11-18T10:00:00Z', status: 'cancelled' },
      { scheduledAt: '2026-11-24T10:00:00Z', status: 'completed' },
      { scheduledAt: '2026-11-24T12:00:00Z', status: 'no_show' },
      { scheduledAt: '2026-11-27T10:00:00Z', status: 'confirmed' },
      { scheduledAt: '2026-10-01T10:00:00Z', status: 'completed' },
    ],
    weeks,
  );
  assert.deepEqual(rows, [
    { weekStart: '2026-11-16', completed: 1, cancelled: 1 },
    { weekStart: '2026-11-23', completed: 1, cancelled: 1 },
  ]);
});

test('readingByWeek counts each member once per week and every reading day', () => {
  const weeks = lastWeekStarts(2, NOW); // 16–22 Nov, 23–29 Nov
  const rows = readingByWeek(
    [
      { '2026-11': [17, 18, 18, 24] }, // reads both weeks (duplicate day counted once)
      { '2026-11': [25], '2026-10': [5] }, // only this week in range
      null,
      { '2026-11': [31, 0, 'x' as unknown as number] }, // invalid days ignored
    ],
    weeks,
  );
  assert.deepEqual(rows, [
    { weekStart: '2026-11-16', readers: 1, readingDays: 2 },
    { weekStart: '2026-11-23', readers: 2, readingDays: 2 },
  ]);
});

test('growthByMonth gives monthly joins and a running total including earlier members', () => {
  const rows = growthByMonth(
    ['2026-08-15', '2026-10-02', '2026-10-20', '2026-11-01', '2026-06-01'],
    lastMonths(3, NOW),
  );
  assert.deepEqual(rows, [
    { month: '2026-09', joined: 0, total: 2 },
    { month: '2026-10', joined: 2, total: 4 },
    { month: '2026-11', joined: 1, total: 5 },
  ]);
});

test('memberHealth buckets by last activity', () => {
  const day = 86_400_000;
  const at = (d: number) => new Date(NOW.getTime() - d * day);
  assert.deepEqual(memberHealth([at(1), at(7), at(8), at(30), at(31), null], NOW), {
    active: 2,
    slipping: 2,
    inactive: 2,
  });
});
