import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { withDbLock } from './dbLock';

function fakeDb(got: number | null) {
  const calls: string[] = [];
  const dataSource: any = {
    createQueryRunner: () => ({
      connect: async () => calls.push('connect'),
      release: async () => calls.push('release'),
      query: async (sql: string) => {
        calls.push(sql.includes('RELEASE_LOCK') ? 'unlock' : 'lock');
        return [{ got }];
      },
    }),
  };
  return { dataSource, calls };
}

describe('withDbLock', () => {
  it('runs the work and frees the lock', async () => {
    const { dataSource, calls } = fakeDb(1);
    const result = await withDbLock('x', async () => 'done', dataSource);
    assert.deepEqual(result, { acquired: true, value: 'done' });
    assert.deepEqual(calls, ['connect', 'lock', 'unlock', 'release']);
  });

  it('skips the work when another process holds the lock', async () => {
    const { dataSource, calls } = fakeDb(0);
    let ran = false;
    const result = await withDbLock('x', async () => { ran = true; }, dataSource);
    assert.deepEqual(result, { acquired: false });
    assert.equal(ran, false);
    assert.deepEqual(calls, ['connect', 'lock', 'release']);
  });

  it('frees the lock when the work fails', async () => {
    const { dataSource, calls } = fakeDb(1);
    await assert.rejects(withDbLock('x', async () => { throw new Error('boom'); }, dataSource), /boom/);
    assert.deepEqual(calls, ['connect', 'lock', 'unlock', 'release']);
  });

  it('refuses to run unprotected when the database gives no answer', async () => {
    const { dataSource, calls } = fakeDb(null);
    let ran = false;
    await assert.rejects(withDbLock('x', async () => { ran = true; }, dataSource), /Could not take/);
    assert.equal(ran, false);
    assert.deepEqual(calls, ['connect', 'lock', 'release']);
  });
});
