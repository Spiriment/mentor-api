import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AREAS,
  areaForBook,
  bookMastery,
  computeProficiency,
  levelFor,
  recencyFactor,
  suggestNext,
  weeklyTrend,
  type ProficiencyAttempt,
} from './quizProficiency';

const ALL_BOOKS = AREAS.flatMap((a) => a.books).filter((b) => !['Song of Solomon', 'Song of Songs'].includes(b));
const now = new Date('2026-11-26T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const attempt = (book: string, version: number, score: number, total = 10, when = now): ProficiencyAttempt => ({
  book,
  version,
  score,
  total,
  completedAt: when,
});

describe('areas', () => {
  it('maps all 66 books, each to one area', () => {
    assert.equal(ALL_BOOKS.length, 66);
    for (const b of ALL_BOOKS) assert.ok(areaForBook(b), b);
    assert.equal(areaForBook('songs of solomon'), 'wisdom');
    assert.equal(areaForBook('Made Up'), undefined);
  });
});

describe('bookMastery', () => {
  it('weights by level and keeps the best result', () => {
    const m = bookMastery([attempt('Genesis', 1, 10), attempt('Genesis', 4, 5), attempt('Genesis', 1, 3)], now);
    // level 1 perfect = 0.4, level 4 half = 0.5 → 0.5
    assert.equal(m.get('genesis'), 0.5);
  });

  it('caps inflated scores and ignores bad levels and unknown books', () => {
    const m = bookMastery([attempt('Exodus', 4, 999, 999), attempt('Exodus', 9, 10), attempt('Fake', 1, 10)], now);
    assert.equal(m.get('exodus'), 1);
    assert.equal(m.has('fake'), false);
  });

  it('ignores attempts after the as-of date', () => {
    assert.equal(bookMastery([attempt('Ruth', 1, 10, 10, now)], daysAgo(1)).size, 0);
  });
});

describe('recencyFactor', () => {
  it('holds for a month, then fades to the floor', () => {
    assert.equal(recencyFactor(daysAgo(10), now), 1);
    assert.equal(recencyFactor(daysAgo(400), now), 0.7);
    const mid = recencyFactor(daysAgo(105), now);
    assert.ok(mid < 1 && mid > 0.7);
  });
});

describe('levelFor', () => {
  it('maps scores to the six levels', () => {
    assert.deepEqual([0, 19, 20, 80, 200, 400, 650, 1000].map((s) => levelFor(s).key), [
      'seed', 'seed', 'sprout', 'sapling', 'fruitful', 'cedar', 'oak', 'oak',
    ]);
    assert.equal(levelFor(0).nextMin, 20);
    assert.equal(levelFor(800).nextMin, null);
  });
});

describe('computeProficiency', () => {
  it('starts everyone at Seed', () => {
    const r = computeProficiency([], ALL_BOOKS, now);
    assert.equal(r.score, 0);
    assert.equal(r.level.key, 'seed');
    assert.equal(r.areas.length, 7);
  });

  it('ten books at level 1 with 70% is Sprout', () => {
    const r = computeProficiency(ALL_BOOKS.slice(0, 10).map((b) => attempt(b, 1, 7)), ALL_BOOKS, now);
    assert.equal(r.level.key, 'sprout');
  });

  it('every book at level 1 with 80% is Fruitful; strong hard levels everywhere is Oak', () => {
    assert.equal(computeProficiency(ALL_BOOKS.map((b) => attempt(b, 1, 8)), ALL_BOOKS, now).level.key, 'fruitful');
    assert.equal(computeProficiency(ALL_BOOKS.map((b) => attempt(b, 4, 8)), ALL_BOOKS, now).level.key, 'oak');
  });

  it('scores an area from its own books and counts coverage', () => {
    const r = computeProficiency([attempt('Matthew', 4, 10), attempt('Mark', 4, 10)], ALL_BOOKS, now);
    const gospels = r.areas.find((a) => a.key === 'gospels')!;
    assert.equal(gospels.score, 500);
    assert.deepEqual([gospels.booksPlayed, gospels.booksTotal], [2, 4]);
  });

  it('counts a book as tried even when nothing was right', () => {
    const r = computeProficiency([attempt('Ruth', 1, 0)], ALL_BOOKS, now);
    assert.equal(r.areas.find((x) => x.key === 'history')!.booksPlayed, 1);
  });

  it('only counts books that have quizzes', () => {
    const r = computeProficiency([attempt('Revelation', 4, 10)], ['Revelation'], now);
    assert.equal(r.areas.length, 1);
    assert.equal(r.score, 1000);
  });
});

describe('weeklyTrend', () => {
  it('rises as attempts are added over the weeks', () => {
    const t = weeklyTrend([attempt('Genesis', 2, 10, 10, daysAgo(20)), attempt('Exodus', 2, 10, 10, daysAgo(2))], ALL_BOOKS, now, 4);
    assert.equal(t.length, 4);
    assert.ok(t[0].score === 0 && t[3].score > t[2].score && t[2].score > 0);
  });
});

describe('suggestNext', () => {
  it('points at the weakest area and an unplayed book in it', () => {
    const attempts = ALL_BOOKS.filter((b) => b !== 'Revelation').map((b) => attempt(b, 1, 8));
    const r = computeProficiency(attempts, ALL_BOOKS, now);
    assert.deepEqual(suggestNext(r.areas, r.mastery, ALL_BOOKS), { areaKey: 'revelation', areaName: 'Revelation', book: 'Revelation' });
  });
});
