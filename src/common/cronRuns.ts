import { AppDataSource } from '@/config/data-source';

/**
 * Production runs more than one backend process (api.spiriment.com and api.paxify.org are
 * served from the same folder, and each starts its own copy), and every copy schedules every
 * cron job. A lock alone isn't enough: a quick job finishes and frees it before the other
 * copy's timer fires, and then that copy runs it again. So each run is recorded in
 * `cron_runs` under (job, minute it was due), and the database's unique key lets exactly
 * one copy claim it.
 */

type Query = (sql: string, params?: unknown[]) => Promise<unknown>;
type Log = { warn: (msg: string) => void; error: (msg: string, err?: Error) => void };

export type CronRunOutcome = 'ran' | 'skipped' | 'ran-unguarded';

const DUPLICATE = new Set(['ER_DUP_ENTRY', '1062']);
const NO_TABLE = new Set(['ER_NO_SUCH_TABLE', '1146']);

function errorCode(err: unknown): string {
  const e = err as { code?: unknown; errno?: unknown; driverError?: { code?: unknown; errno?: unknown } };
  return String(e?.driverError?.code ?? e?.code ?? e?.driverError?.errno ?? e?.errno ?? '');
}

/** 'YYYY-MM-DD HH:MM:SS' in UTC, written as text so the connection's timezone can't shift it */
const utcSql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** The minute a run belongs to (UTC), so both copies' timers firing that minute share one key */
export function cronRunMinute(now: Date): string {
  const d = new Date(now.getTime());
  d.setUTCSeconds(0, 0);
  return utcSql(d);
}

let warnedMissingTable = false;

/**
 * Runs `fn` unless another process already claimed this job for this minute.
 *
 * If the claim can't be made for any other reason (the migration hasn't been run yet, the
 * database blipped), the job runs anyway: that is how it behaved before, and a missed
 * reminder or invoice is worse than a rare duplicate. If `fn` throws, the claim is removed
 * so the run isn't recorded as done.
 */
export async function runCronOnce(
  job: string,
  fn: () => Promise<unknown>,
  deps: { query?: Query; now?: () => Date; log?: Log } = {},
): Promise<CronRunOutcome> {
  const query: Query = deps.query ?? ((sql, params) => AppDataSource.query(sql, params));
  const runAt = cronRunMinute((deps.now ?? (() => new Date()))());
  const log = deps.log ?? console;

  let claimed = false;
  try {
    await query('INSERT INTO `cron_runs` (`job`, `runAt`, `startedAt`) VALUES (?, ?, UTC_TIMESTAMP())', [job, runAt]);
    claimed = true;
  } catch (err) {
    const code = errorCode(err);
    if (DUPLICATE.has(code)) return 'skipped';
    if (NO_TABLE.has(code)) {
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        log.warn('cron_runs table missing: cron jobs run unguarded until the migration is run');
      }
    } else {
      log.error(`Could not claim cron run ${job}; running it anyway`, err instanceof Error ? err : new Error(String(err)));
    }
  }

  try {
    await fn();
  } catch (err) {
    if (claimed) {
      await query('DELETE FROM `cron_runs` WHERE `job` = ? AND `runAt` = ?', [job, runAt]).catch(() => undefined);
    }
    throw err;
  }

  if (claimed) {
    await query('UPDATE `cron_runs` SET `finishedAt` = UTC_TIMESTAMP() WHERE `job` = ? AND `runAt` = ?', [job, runAt]).catch(
      () => undefined,
    );
  }
  return claimed ? 'ran' : 'ran-unguarded';
}

/** Deletes run records older than `days`; the every-minute jobs add about 4,000 rows a day */
export async function pruneCronRuns(
  days: number,
  query: Query = (sql, params) => AppDataSource.query(sql, params),
  now: Date = new Date(),
) {
  const cutoff = utcSql(new Date(now.getTime() - days * 86_400_000));
  const result = (await query('DELETE FROM `cron_runs` WHERE `runAt` < ?', [cutoff])) as { affectedRows?: number };
  return result?.affectedRows ?? 0;
}

/** For tests */
export function resetCronRunWarnings() {
  warnedMissingTable = false;
}
