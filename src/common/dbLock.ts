import type { DataSource } from 'typeorm';
import { AppDataSource } from '@/config/data-source';

export type DbLockResult<T> = { acquired: true; value: T } | { acquired: false };

/**
 * Runs `fn` while holding a named MySQL lock, so only one backend process does it at a time.
 * Production runs more than one process against the same database. Doesn't wait: if another
 * process holds the lock, `fn` doesn't run. MySQL frees the lock if the process dies.
 *
 * Throws if the lock can't be taken at all: callers guard things like sending invoices, which
 * must not go ahead unprotected. `name` is server-wide and limited to 64 characters.
 */
export async function withDbLock<T>(
  name: string,
  fn: () => Promise<T>,
  dataSource: Pick<DataSource, 'createQueryRunner'> = AppDataSource,
): Promise<DbLockResult<T>> {
  // The lock belongs to one connection, so hold the same one from GET_LOCK to RELEASE_LOCK
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    const [row] = await runner.query('SELECT GET_LOCK(?, 0) AS got', [name]);
    // NULL means MySQL couldn't take it. Number(null) is 0, which would read as "someone else has it".
    if (row?.got === null || row?.got === undefined) throw new Error(`Could not take database lock ${name}`);
    if (Number(row.got) !== 1) return { acquired: false };

    try {
      return { acquired: true, value: await fn() };
    } finally {
      await runner.query('SELECT RELEASE_LOCK(?)', [name]);
    }
  } finally {
    await runner.release();
  }
}
