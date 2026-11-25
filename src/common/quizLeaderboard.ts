/**
 * Rules that keep the quiz leaderboard honest.
 *
 * The app grades a quiz itself and posts the score, so the server can't trust the numbers it
 * receives. It can, however, refuse anything a real quiz can't produce: a quiz is at most
 * MAX_QUIZ_QUESTIONS questions from a real book at levels 1–4, and it can't finish in the future.
 * The leaderboard applies the same caps to attempts already stored, so scores inflated before
 * these checks stop counting too.
 */

/** Questions per quiz round (BATCH_SIZE in the app's QuizScreen) */
export const MAX_QUIZ_QUESTIONS = 10;
export const MIN_QUIZ_VERSION = 1;
export const MAX_QUIZ_VERSION = 4;
/** Phone clocks drift; anything later than this is treated as "now" */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** XP multiplier per level */
export const VERSION_MULTIPLIER: Record<number, number> = { 1: 1.0, 2: 1.5, 3: 2.0, 4: 3.0 };

export function isValidQuizVersion(version: unknown): version is number {
  return Number.isInteger(version) && (version as number) >= MIN_QUIZ_VERSION && (version as number) <= MAX_QUIZ_VERSION;
}

function toInt(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Caps a posted attempt to what the quiz could actually produce. Out-of-range numbers are
 * clamped rather than rejected, so a genuine attempt waiting in an app's offline queue is never
 * refused and retried forever.
 */
export function normalizeAttemptNumbers(
  input: { score: unknown; total: unknown; completedAt: unknown },
  questionsAvailable: number,
  now: Date = new Date(),
): { score: number; total: number; completedAt: Date } {
  const maxTotal = Math.max(1, Math.min(MAX_QUIZ_QUESTIONS, questionsAvailable));
  const total = Math.min(Math.max(toInt(input.total), 1), maxTotal);
  const score = Math.min(Math.max(toInt(input.score), 0), total);

  const parsed = typeof input.completedAt === 'string' || input.completedAt instanceof Date
    ? new Date(input.completedAt as string)
    : new Date(NaN);
  const completedAt =
    Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime() + FUTURE_TOLERANCE_MS ? now : parsed;

  return { score, total, completedAt };
}

/** "Olawore Ahmad" → "Olawore A." — the leaderboard is shown to every Basic member */
export function leaderboardDisplayName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? '').trim();
  const lastInitial = (lastName ?? '').trim().charAt(0).toUpperCase();
  if (first && lastInitial) return `${first} ${lastInitial}.`;
  if (first) return first;
  if (lastInitial) return `${lastInitial}.`;
  return 'Member';
}

/** Ranks rows already sorted best-first; equal XP shares a rank (1, 2, 2, 4) */
export function assignRanks<T extends { xp: number }>(sorted: T[]): (T & { rank: number })[] {
  let rank = 0;
  let prevXp: number | null = null;
  return sorted.map((row, i) => {
    if (prevXp === null || row.xp !== prevXp) rank = i + 1;
    prevXp = row.xp;
    return { ...row, rank };
  });
}
