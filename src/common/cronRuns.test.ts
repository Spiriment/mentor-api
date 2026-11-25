import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { cronRunMinute, pruneCronRuns, resetCronRunWarnings, runCronOnce } from './cronRuns';

/** A fake cron_runs table with the same unique key as the real one */
function fakeTable(opts: { missing?: boolean; failInsert?: boolean } = {}) {
  const rows = new Map<string, { finished: boolean }>();
  const query = async (sql: string, params: unknown[] = []) => {
    if (opts.missing) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
    const key = `${params[0]}|${params[1]}`;
    if (sql.startsWith('INSERT')) {
      if (opts.failInsert) throw Object.assign(new Error('gone away'), { code: 'PROTOCOL_CONNECTION_LOST' });
      // TypeORM wraps driver errors; the code sits on driverError
      if (rows.has(key)) throw Object.assign(new Error('dup'), { driverError: { code: 'ER_DUP_ENTRY' } });
      rows.set(key, { finished: false });
    } else if (sql.startsWith('UPDATE')) {
      const row = rows.get(key);
      if (row) row.finished = true;
    } else if (sql.startsWith('DELETE FROM `cron_runs` WHERE `job`')) {
      rows.delete(key);
    }
    return {};
  };
  return { rows, query };
}

const quietLog = { warn: () => undefined, error: () => undefined };
const at = (iso: string) => () => new Date(iso);

describe('runCronOnce', () => {
  beforeEach(() => resetCronRunWarnings());

  it('runs a job once when two processes fire in the same minute', async () => {
    const { rows, query } = fakeTable();
    let runs = 0;
    const job = async () => {
      runs += 1;
    };
    const a = await runCronOnce('monthly-report', job, { query, now: at('2026-12-01T00:00:00.120Z'), log: quietLog });
    const b = await runCronOnce('monthly-report', job, { query, now: at('2026-12-01T00:00:00.950Z'), log: quietLog });
    assert.equal(a, 'ran');
    assert.equal(b, 'skipped');
    assert.equal(runs, 1);
    assert.deepEqual([...rows.entries()], [['monthly-report|2026-12-01 00:00:00', { finished: true }]]);
  });

  it('runs again in the next minute, and other jobs in the same minute', async () => {
    const { query } = fakeTable();
    let runs = 0;
    const job = async () => {
      runs += 1;
    };
    await runCronOnce('broadcast-schedule', job, { query, now: at('2026-11-24T17:05:10Z'), log: quietLog });
    await runCronOnce('broadcast-schedule', job, { query, now: at('2026-11-24T17:06:10Z'), log: quietLog });
    await runCronOnce('notification-processing', job, { query, now: at('2026-11-24T17:06:10Z'), log: quietLog });
    assert.equal(runs, 3);
  });

  it('frees the claim when the job throws', async () => {
    const { rows, query } = fakeTable();
    await assert.rejects(
      runCronOnce(
        'trial-convert',
        async () => {
          throw new Error('boom');
        },
        { query, now: at('2026-11-24T10:00:00Z'), log: quietLog },
      ),
      /boom/,
    );
    assert.equal(rows.size, 0);
  });

  it('still runs the job before the migration is run', async () => {
    const { query } = fakeTable({ missing: true });
    let warned = 0;
    let runs = 0;
    const log = { warn: () => void (warned += 1), error: () => undefined };
    const job = async () => {
      runs += 1;
    };
    assert.equal(await runCronOnce('streak-reminder', job, { query, log }), 'ran-unguarded');
    assert.equal(await runCronOnce('streak-reminder', job, { query, log }), 'ran-unguarded');
    assert.equal(runs, 2);
    assert.equal(warned, 1);
  });

  it('still runs the job when the claim fails for another reason', async () => {
    const { query } = fakeTable({ failInsert: true });
    let errors = 0;
    let runs = 0;
    const log = { warn: () => undefined, error: () => void (errors += 1) };
    const outcome = await runCronOnce(
      'church-auto-invoice',
      async () => {
        runs += 1;
      },
      { query, log },
    );
    assert.equal(outcome, 'ran-unguarded');
    assert.equal(runs, 1);
    assert.equal(errors, 1);
  });
});

describe('cronRunMinute', () => {
  it('drops seconds and stays in UTC', () => {
    assert.equal(cronRunMinute(new Date('2026-11-24T23:59:59.999+01:00')), '2026-11-24 22:59:00');
  });
});

describe('pruneCronRuns', () => {
  it('deletes rows older than the cutoff and returns the count', async () => {
    let params: unknown[] = [];
    const deleted = await pruneCronRuns(
      14,
      async (_sql, p = []) => {
        params = p;
        return { affectedRows: 42 };
      },
      new Date('2026-11-24T00:50:00Z'),
    );
    assert.equal(deleted, 42);
    assert.deepEqual(params, ['2026-11-10 00:50:00']);
  });
});
