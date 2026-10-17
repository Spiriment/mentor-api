/**
 * Merge rules for study progress saves coming from multiple devices.
 *
 * Clients used to PUT their whole cached progress object, which the server stored as-is —
 * so a stale device (e.g. an iPad left open since yesterday) silently erased chapters
 * completed on another device, or even reverted a path switch.
 *
 * The server can't recompute the reading cursor (path definitions live only in the app,
 * which recalculates the cursor from completedChapters on every load), so these rules only
 * guarantee the sets never lose data:
 *  - completedPathIds is always unioned — a finished path is never forgotten.
 *  - Same path: completedChapters is unioned, so saves commute regardless of order.
 *  - Only an explicit `start_path` intent may replace completedChapters / switch paths.
 */

export type StudyProgressIntent = 'start_path' | 'update';

export interface StudyProgressFields {
  pathId: string;
  currentBookIndex: number;
  currentChapterIndex: number;
  completedChapters: string[];
  completedPathIds: string[];
  currentDay: number;
  totalDays: number;
  lastStudiedAt?: Date;
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const toInt = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;

const toDate = (value: unknown): Date | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const union = (a: string[], b: string[]): string[] => Array.from(new Set([...a, ...b]));

const latest = (a?: Date, b?: Date): Date | undefined => {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
};

/**
 * Whitelist and coerce a request body into progress fields. Unknown keys (id, userId,
 * timestamps…) are dropped so a client can't overwrite columns it doesn't own.
 */
export function sanitizeIncomingProgress(
  body: Record<string, unknown>,
): StudyProgressFields | null {
  if (typeof body.pathId !== 'string' || !body.pathId) return null;
  return {
    pathId: body.pathId,
    currentBookIndex: toInt(body.currentBookIndex, 0),
    currentChapterIndex: toInt(body.currentChapterIndex, 0),
    completedChapters: toStringArray(body.completedChapters),
    completedPathIds: toStringArray(body.completedPathIds),
    currentDay: toInt(body.currentDay, 0),
    totalDays: toInt(body.totalDays, 0),
    lastStudiedAt: toDate(body.lastStudiedAt),
  };
}

/**
 * @param intent `start_path` = user deliberately started/switched a path (may reset);
 *   `update` = progress within the current path (new clients); `undefined` = legacy
 *   client that sends no intent.
 */
export function mergeStudyProgress(
  existing: StudyProgressFields | null,
  incoming: StudyProgressFields,
  intent: StudyProgressIntent | undefined,
  now: Date = new Date(),
): StudyProgressFields {
  // As before: an explicit lastStudiedAt is kept (load-time backfill saves must not bump it),
  // otherwise any save counts as studying now. Never move it backwards.
  const lastStudiedAt = incoming.lastStudiedAt
    ? latest(existing?.lastStudiedAt, incoming.lastStudiedAt)
    : now;

  if (!existing) {
    return { ...incoming, lastStudiedAt };
  }

  const completedPathIds = union(existing.completedPathIds, incoming.completedPathIds);

  if (intent === 'start_path') {
    return { ...incoming, completedPathIds, lastStudiedAt };
  }

  if (incoming.pathId !== existing.pathId) {
    if (intent === 'update') {
      // New client wrote progress for a path the user has since left on another device.
      // Its chapters belong to the old path — keep the server's current path untouched.
      return { ...existing, completedPathIds, lastStudiedAt };
    }
    // Legacy clients signal a path switch only by sending a different pathId.
    return { ...incoming, completedPathIds, lastStudiedAt };
  }

  // Same path: union chapters so a stale device can add but never remove.
  const completedChapters = union(existing.completedChapters, incoming.completedChapters);

  // A device that knew of fewer chapters than the server has a stale cursor; keep the
  // server's. (The app recomputes the cursor from completedChapters on every load anyway.)
  const incomingIsStale = existing.completedChapters.some(
    (c) => !incoming.completedChapters.includes(c),
  );
  const cursorSource = incomingIsStale ? existing : incoming;

  return {
    pathId: existing.pathId,
    currentBookIndex: cursorSource.currentBookIndex,
    currentChapterIndex: cursorSource.currentChapterIndex,
    currentDay: Math.max(existing.currentDay, incoming.currentDay),
    totalDays: incoming.totalDays || existing.totalDays,
    completedChapters,
    completedPathIds,
    lastStudiedAt,
  };
}
