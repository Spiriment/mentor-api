import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeStudyProgress,
  sanitizeIncomingProgress,
  type StudyProgressFields,
} from './mergeStudyProgress';

const base = (overrides: Partial<StudyProgressFields> = {}): StudyProgressFields => ({
  pathId: 'foundations',
  currentBookIndex: 0,
  currentChapterIndex: 0,
  completedChapters: [],
  completedPathIds: [],
  currentDay: 0,
  totalDays: 100,
  ...overrides,
});

describe('mergeStudyProgress', () => {
  it('stale device cannot erase chapters completed on another device', () => {
    const server = base({ completedChapters: ['John:1', 'John:2', 'John:3'], currentDay: 3 });
    const staleIpad = base({ completedChapters: ['John:1', 'Mark:1'], currentDay: 2 });
    const merged = mergeStudyProgress(server, staleIpad, 'update');
    assert.deepEqual(new Set(merged.completedChapters), new Set(['John:1', 'John:2', 'John:3', 'Mark:1']));
    assert.equal(merged.currentDay, 3);
  });

  it('saves commute — arrival order does not change the result', () => {
    const server = base({ completedChapters: ['John:1'] });
    const phone = base({ completedChapters: ['John:1', 'John:2'] });
    const ipad = base({ completedChapters: ['John:1', 'Mark:1'] });
    const a = mergeStudyProgress(mergeStudyProgress(server, phone, 'update'), ipad, 'update');
    const b = mergeStudyProgress(mergeStudyProgress(server, ipad, 'update'), phone, 'update');
    assert.deepEqual(new Set(a.completedChapters), new Set(b.completedChapters));
    assert.equal(a.completedChapters.length, 3);
  });

  it('keeps the server cursor when the incoming device is stale', () => {
    const server = base({ completedChapters: ['John:1', 'John:2'], currentChapterIndex: 2 });
    const stale = base({ completedChapters: ['John:1'], currentChapterIndex: 1 });
    assert.equal(mergeStudyProgress(server, stale, 'update').currentChapterIndex, 2);
  });

  it('takes the incoming cursor when the device is up to date', () => {
    const server = base({ completedChapters: ['John:1'], currentChapterIndex: 1 });
    const fresh = base({ completedChapters: ['John:1', 'John:2'], currentChapterIndex: 2 });
    assert.equal(mergeStudyProgress(server, fresh, 'update').currentChapterIndex, 2);
  });

  it('start_path deliberately resets chapters but keeps finished paths', () => {
    const server = base({ completedChapters: ['John:1'], completedPathIds: ['old-path'] });
    const switched = base({ pathId: 'psalms', completedChapters: [], completedPathIds: [] });
    const merged = mergeStudyProgress(server, switched, 'start_path');
    assert.equal(merged.pathId, 'psalms');
    assert.deepEqual(merged.completedChapters, []);
    assert.deepEqual(merged.completedPathIds, ['old-path']);
  });

  it('start_path on the same path restarts it', () => {
    const server = base({ completedChapters: ['John:1', 'John:2'] });
    const merged = mergeStudyProgress(server, base(), 'start_path');
    assert.deepEqual(merged.completedChapters, []);
  });

  it('update for a path the user already left does not revert the switch', () => {
    const server = base({ pathId: 'psalms', completedChapters: ['Psalms:1'] });
    const staleOldPath = base({ pathId: 'foundations', completedChapters: ['John:1', 'John:2'] });
    const merged = mergeStudyProgress(server, staleOldPath, 'update');
    assert.equal(merged.pathId, 'psalms');
    assert.deepEqual(merged.completedChapters, ['Psalms:1']);
  });

  it('legacy client (no intent) switching path still works', () => {
    const server = base({ completedChapters: ['John:1'], completedPathIds: ['done'] });
    const legacySwitch = base({ pathId: 'psalms', completedChapters: [] });
    const merged = mergeStudyProgress(server, legacySwitch, undefined);
    assert.equal(merged.pathId, 'psalms');
    assert.deepEqual(merged.completedChapters, []);
    assert.deepEqual(merged.completedPathIds, ['done']);
  });

  it('legacy client on the same path is merged, not overwritten', () => {
    const server = base({ completedChapters: ['John:1', 'John:2'] });
    const legacyStale = base({ completedChapters: ['John:1'] });
    const merged = mergeStudyProgress(server, legacyStale, undefined);
    assert.deepEqual(new Set(merged.completedChapters), new Set(['John:1', 'John:2']));
  });

  it('completedPathIds is never lost on any save', () => {
    const server = base({ completedPathIds: ['a', 'b'] });
    for (const intent of ['update', 'start_path', undefined] as const) {
      const merged = mergeStudyProgress(server, base({ completedPathIds: ['c'] }), intent);
      assert.deepEqual(new Set(merged.completedPathIds), new Set(['a', 'b', 'c']));
    }
  });

  it('keeps an explicit lastStudiedAt and never moves it backwards', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const server = base({ lastStudiedAt: new Date('2026-10-16T08:00:00Z') });
    const older = base({ lastStudiedAt: new Date('2026-10-10T08:00:00Z') });
    assert.equal(
      mergeStudyProgress(server, older, 'update', now).lastStudiedAt?.toISOString(),
      '2026-10-16T08:00:00.000Z',
    );
    assert.equal(mergeStudyProgress(server, base(), 'update', now).lastStudiedAt, now);
  });

  it('creates progress when none exists', () => {
    const merged = mergeStudyProgress(null, base({ completedChapters: ['John:1'] }), 'update');
    assert.deepEqual(merged.completedChapters, ['John:1']);
  });
});

describe('sanitizeIncomingProgress', () => {
  it('drops unknown keys and coerces types', () => {
    const clean = sanitizeIncomingProgress({
      id: 'someone-elses-row',
      userId: 'attacker',
      pathId: 'foundations',
      completedChapters: ['John:1', 42, null],
      currentDay: '7',
    });
    assert.ok(clean);
    assert.equal((clean as any).id, undefined);
    assert.equal((clean as any).userId, undefined);
    assert.deepEqual(clean.completedChapters, ['John:1']);
    assert.equal(clean.currentDay, 0);
  });

  it('rejects a body without a pathId', () => {
    assert.equal(sanitizeIncomingProgress({ completedChapters: [] }), null);
  });
});
