/**
 * One-off repair for streaks lost in the 17–19 Oct 2026 outage.
 *
 * From the deploy at 2026-10-17 16:57 UTC until the users.pushPlatform migration ran, every
 * streak increment failed. Reading sessions were still saved, so this re-credits those days.
 *
 *   npm run repair:streaks          → dry run: prints every change, writes nothing
 *   npm run repair:streaks:apply    → applies the same changes
 *
 * Safe to run more than once (already-credited days are skipped). See common/streakRepair.ts.
 */
import 'reflect-metadata';
import { In, MoreThanOrEqual } from 'typeorm';
import { formatInTimeZone } from 'date-fns-tz';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { StudySession } from '@/database/entities/studySession.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { repairStreak, type StreakState } from '@/common/streakRepair';

// 1 hour before the breaking deploy, as margin; days already recorded are skipped anyway
const WINDOW_START = new Date('2026-10-17T16:00:00Z');
const APPLY = process.argv.includes('--apply');
const STREAK_TIERS = ['basic', 'pro', 'premium'];
const ACCESS_STATUSES = ['active', 'trialing', 'past_due'];

const dayOf = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
};

const stateOf = (u: User): StreakState => ({
  currentStreak: u.currentStreak ?? 0,
  longestStreak: u.longestStreak ?? 0,
  lastStreakDate: dayOf(u.lastStreakDate),
  monthlyStreakData: u.monthlyStreakData ?? {},
  weeklyStreakData: Array.isArray(u.weeklyStreakData) ? u.weeklyStreakData : new Array(7).fill(false),
});

const STREAK_COLUMNS: (keyof User)[] = [
  'id', 'firstName', 'lastName', 'email', 'timezone', 'currentStreak', 'longestStreak',
  'lastStreakDate', 'monthlyStreakData', 'weeklyStreakData',
];

async function main() {
  await AppDataSource.initialize();
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN (nothing will be written)'} — sessions since ${WINDOW_START.toISOString()}\n`);

  const sessions = await AppDataSource.getRepository(StudySession).find({
    where: { completedAt: MoreThanOrEqual(WINDOW_START) },
    select: ['userId', 'completedAt'],
  });
  const userIds = Array.from(new Set(sessions.map((s) => s.userId)));
  if (userIds.length === 0) {
    console.log('No reading sessions in the window — nothing to repair.');
    return;
  }

  const subs = await AppDataSource.getRepository(UserSubscription).find({
    where: { userId: In(userIds) },
    select: ['userId', 'tier', 'status'],
  });
  // Same rule as requireSubscription('basic') on the streak endpoints
  const eligible = new Set(
    subs.filter((s) => ACCESS_STATUSES.includes(s.status) && STREAK_TIERS.includes(s.tier)).map((s) => s.userId),
  );

  const users = await AppDataSource.getRepository(User).find({
    where: { id: In(userIds.filter((id) => eligible.has(id))) },
    select: STREAK_COLUMNS,
  });

  let repaired = 0;
  for (const user of users) {
    const tz = user.timezone || 'UTC';
    const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
    const sessionDays = sessions
      .filter((s) => s.userId === user.id)
      .map((s) => formatInTimeZone(new Date(s.completedAt), tz, 'yyyy-MM-dd'));

    const plan = repairStreak(stateOf(user), sessionDays, today);
    if (!plan.changed) continue;
    repaired++;

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    console.log(
      `${name} (${user.id.slice(0, 8)}, ${tz}): +${plan.addedDays.join(', ')} → streak ${user.currentStreak} → ${plan.next.currentStreak}`,
    );

    if (APPLY) {
      await AppDataSource.transaction(async (manager) => {
        const repo = manager.getRepository(User);
        // Re-read under a row lock and recompute, in case the user read since the dry run
        const locked = await repo.findOne({
          where: { id: user.id },
          select: STREAK_COLUMNS,
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) return;
        const fresh = repairStreak(stateOf(locked), sessionDays, today);
        if (!fresh.changed) return;
        await repo.update(user.id, {
          currentStreak: fresh.next.currentStreak,
          longestStreak: fresh.next.longestStreak,
          lastStreakDate: fresh.next.lastStreakDate as unknown as Date,
          monthlyStreakData: fresh.next.monthlyStreakData,
          weeklyStreakData: fresh.next.weeklyStreakData,
        });
      });
    }
  }

  console.log(
    `\n${userIds.length} users read in the window, ${eligible.size} have a plan with streaks, ` +
      `${repaired} ${APPLY ? 'repaired' : 'would be repaired'}.`,
  );
  if (!APPLY && repaired > 0) console.log('Run `npm run repair:streaks:apply` to apply these changes.');
}

main()
  .catch((err) => {
    console.error('Streak repair failed:', err);
    process.exitCode = 1;
  })
  .finally(() => AppDataSource.isInitialized && AppDataSource.destroy());
