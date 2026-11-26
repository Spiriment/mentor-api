import { MAX_QUIZ_QUESTIONS } from './quizLeaderboard';

/**
 * Scripture Proficiency: how well someone knows each part of the Bible, from their quiz results.
 *
 * Book mastery (0–1) = best result on that book, weighted by level (a perfect level 1 is worth
 * 0.4, level 4 is worth 1.0), faded a little when it hasn't been played for a while.
 * Area score (0–1000) = mean mastery over the area's books, so playing more of its books grows it.
 * Overall score (0–1000) = mean mastery over every book.
 * Pure functions: the service loads attempts and books, this does the maths (and is unit-tested).
 */

export type AreaKey = 'law' | 'history' | 'wisdom' | 'prophets' | 'gospels' | 'letters' | 'revelation';

export const AREAS: { key: AreaKey; name: string; books: string[] }[] = [
  { key: 'law', name: 'The Law', books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
  {
    key: 'history',
    name: 'History',
    books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'],
  },
  { key: 'wisdom', name: 'Wisdom & Poetry', books: ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Songs of Solomon', 'Song of Solomon', 'Song of Songs'] },
  {
    key: 'prophets',
    name: 'Prophets',
    books: [
      'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
      'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
    ],
  },
  { key: 'gospels', name: 'Gospels', books: ['Matthew', 'Mark', 'Luke', 'John'] },
  {
    key: 'letters',
    name: 'Acts & Letters',
    books: [
      'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians',
      '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
      '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude',
    ],
  },
  { key: 'revelation', name: 'Revelation', books: ['Revelation'] },
];

const AREA_BY_BOOK = new Map<string, AreaKey>();
for (const a of AREAS) for (const b of a.books) AREA_BY_BOOK.set(b.toLowerCase(), a.key);

export function areaForBook(book: string): AreaKey | undefined {
  return AREA_BY_BOOK.get(book.trim().toLowerCase());
}

/** A perfect round at each level is worth this much of a book's mastery */
export const LEVEL_WEIGHT: Record<number, number> = { 1: 0.4, 2: 0.6, 3: 0.8, 4: 1.0 };

/** No fading for this long, then a slow slide down to RECENCY_FLOOR */
export const RECENCY_FULL_DAYS = 30;
export const RECENCY_FLOOR_DAYS = 180;
export const RECENCY_FLOOR = 0.7;

export const LEVELS = [
  { key: 'seed', name: 'Seed', min: 0, verse: 'Mark 4:31' },
  { key: 'sprout', name: 'Sprout', min: 20, verse: 'Mark 4:28' },
  { key: 'sapling', name: 'Sapling', min: 80, verse: 'Psalm 1:3' },
  { key: 'fruitful', name: 'Fruitful', min: 200, verse: 'John 15:5' },
  { key: 'cedar', name: 'Cedar', min: 400, verse: 'Psalm 92:12' },
  { key: 'oak', name: 'Oak of Righteousness', min: 650, verse: 'Isaiah 61:3' },
] as const;

export type ProficiencyAttempt = { book: string; version: number; score: number; total: number; completedAt: Date };

const DAY_MS = 86_400_000;

export function recencyFactor(lastPlayed: Date, asOf: Date): number {
  const days = (asOf.getTime() - lastPlayed.getTime()) / DAY_MS;
  if (days <= RECENCY_FULL_DAYS) return 1;
  if (days >= RECENCY_FLOOR_DAYS) return RECENCY_FLOOR;
  const t = (days - RECENCY_FULL_DAYS) / (RECENCY_FLOOR_DAYS - RECENCY_FULL_DAYS);
  return 1 - t * (1 - RECENCY_FLOOR);
}

/** Same caps as the leaderboard: a round is at most MAX_QUIZ_QUESTIONS and can't exceed its total */
function roundFraction(a: ProficiencyAttempt): number {
  const total = Math.min(Math.max(Math.floor(a.total), 1), MAX_QUIZ_QUESTIONS);
  const score = Math.min(Math.max(Math.floor(a.score), 0), total);
  return score / total;
}

/** Mastery (0–1) per book, from attempts completed on or before `asOf` */
export function bookMastery(attempts: ProficiencyAttempt[], asOf: Date): Map<string, number> {
  const best = new Map<string, { value: number; last: Date }>();
  for (const a of attempts) {
    if (a.completedAt.getTime() > asOf.getTime()) continue;
    const weight = LEVEL_WEIGHT[a.version];
    if (!weight || !areaForBook(a.book)) continue;
    const key = a.book.trim().toLowerCase();
    const value = roundFraction(a) * weight;
    const prev = best.get(key);
    best.set(key, {
      value: Math.max(prev?.value ?? 0, value),
      last: !prev || a.completedAt > prev.last ? a.completedAt : prev.last,
    });
  }
  const out = new Map<string, number>();
  for (const [book, { value, last }] of best) out.set(book, value * recencyFactor(last, asOf));
  return out;
}

export function levelFor(score: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (score >= LEVELS[i].min) index = i;
  const level = LEVELS[index];
  const next = LEVELS[index + 1];
  return {
    key: level.key,
    name: level.name,
    verse: level.verse,
    index,
    min: level.min,
    nextName: next?.name ?? null,
    nextMin: next?.min ?? null,
  };
}

export type AreaResult = { key: AreaKey; name: string; score: number; booksPlayed: number; booksTotal: number };

/**
 * Scores as of `asOf`. `availableBooks` are the books that have quizzes; an area only counts
 * the books it can actually be quizzed on.
 */
export function computeProficiency(attempts: ProficiencyAttempt[], availableBooks: string[], asOf: Date) {
  const available = new Set(availableBooks.map((b) => b.trim().toLowerCase()).filter((b) => AREA_BY_BOOK.has(b)));
  const mastery = bookMastery(attempts, asOf);

  const areas: AreaResult[] = AREAS.map((area) => {
    const books = area.books.map((b) => b.toLowerCase()).filter((b) => available.has(b));
    const sum = books.reduce((acc, b) => acc + (mastery.get(b) ?? 0), 0);
    return {
      key: area.key,
      name: area.name,
      score: books.length ? Math.round((sum / books.length) * 1000) : 0,
      // Any attempt counts as having tried the book, even a round with nothing right
      booksPlayed: books.filter((b) => mastery.has(b)).length,
      booksTotal: books.length,
    };
  }).filter((a) => a.booksTotal > 0);

  const allSum = [...available].reduce((acc, b) => acc + (mastery.get(b) ?? 0), 0);
  const score = available.size ? Math.round((allSum / available.size) * 1000) : 0;
  return { score, level: levelFor(score), areas, mastery };
}

/** Weekly overall score for the last `weeks` weeks (oldest first), recomputed as of each week's end */
export function weeklyTrend(attempts: ProficiencyAttempt[], availableBooks: string[], now: Date, weeks = 12) {
  const points: { weekEnding: string; score: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const asOf = new Date(now.getTime() - i * 7 * DAY_MS);
    points.push({ weekEnding: asOf.toISOString().slice(0, 10), score: computeProficiency(attempts, availableBooks, asOf).score });
  }
  return points;
}

/** Where to grow next: the weakest area, and a book in it (unplayed first, else the weakest) */
export function suggestNext(
  areas: AreaResult[],
  mastery: Map<string, number>,
  availableBooks: string[],
): { areaKey: AreaKey; areaName: string; book: string } | null {
  if (areas.length === 0) return null;
  const weakest = [...areas].sort((a, b) => a.score - b.score)[0];
  const area = AREAS.find((a) => a.key === weakest.key)!;
  const availableByLower = new Map(availableBooks.map((b) => [b.trim().toLowerCase(), b]));
  const books = area.books.filter((b) => availableByLower.has(b.toLowerCase()));
  if (books.length === 0) return null;
  const unplayed = books.find((b) => !mastery.has(b.toLowerCase()));
  const pick =
    unplayed ?? [...books].sort((a, b) => (mastery.get(a.toLowerCase()) ?? 0) - (mastery.get(b.toLowerCase()) ?? 0))[0];
  return { areaKey: weakest.key, areaName: weakest.name, book: availableByLower.get(pick.toLowerCase()) ?? pick };
}
