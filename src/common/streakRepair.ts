/**
 * Repair streaks lost to the 17–19 Oct 2026 outage, when every streak increment failed
 * (the deployed code selected users.pushPlatform before its migration had run). Reading
 * sessions (study_sessions) were still saved, so they show which days users really read.
 *
 * Rules: only add reading days, recompute the streak from consecutive reading days, and
 * never lower anyone's current or longest streak. Idempotent.
 */

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD in the user's timezone, or null */
  lastStreakDate: string | null;
  monthlyStreakData: Record<string, number[]>;
  weeklyStreakData: boolean[];
}

export interface StreakRepairResult {
  changed: boolean;
  addedDays: string[];
  next: StreakState;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toUtc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const addDays = (day: string, n: number) => fromUtc(toUtc(day) + n * 86_400_000);

function daysFromMonthly(monthly: Record<string, number[]>): Set<string> {
  const days = new Set<string>();
  for (const [month, list] of Object.entries(monthly ?? {})) {
    if (!/^\d{4}-\d{2}$/.test(month) || !Array.isArray(list)) continue;
    for (const d of list) if (Number.isInteger(d) && d >= 1 && d <= 31) days.add(`${month}-${pad(d)}`);
  }
  return days;
}

/**
 * @param sessionDays days (YYYY-MM-DD, user's timezone) with a qualifying reading session
 * @param today today's date in the user's timezone (for the Sunday-start weekly view)
 */
export function repairStreak(state: StreakState, sessionDays: string[], today: string): StreakRepairResult {
  const existing = daysFromMonthly(state.monthlyStreakData);
  const addedDays = Array.from(new Set(sessionDays))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !existing.has(d) && d <= today)
    .sort();
  if (addedDays.length === 0) return { changed: false, addedDays, next: state };

  const all = new Set([...existing, ...addedDays]);
  const lastDay = Array.from(all).sort().pop()!;

  // Consecutive reading days ending on the most recent one
  let run = 0;
  for (let d = lastDay; all.has(d); d = addDays(d, -1)) run++;

  const currentStreak = Math.max(state.currentStreak, run);
  const monthlyStreakData: Record<string, number[]> = { ...state.monthlyStreakData };
  for (const d of addedDays) {
    const month = d.slice(0, 7);
    const day = Number(d.slice(8, 10));
    monthlyStreakData[month] = Array.from(new Set([...(monthlyStreakData[month] ?? []), day])).sort((a, b) => a - b);
  }

  // This week's dots (Sunday = index 0), from the full set of reading days
  const weekday = new Date(toUtc(today)).getUTCDay();
  const sunday = addDays(today, -weekday);
  const weeklyStreakData = Array.from({ length: 7 }, (_, i) => all.has(addDays(sunday, i)));

  return {
    changed: true,
    addedDays,
    next: {
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      lastStreakDate: state.lastStreakDate && state.lastStreakDate > lastDay ? state.lastStreakDate : lastDay,
      monthlyStreakData,
      weeklyStreakData,
    },
  };
}
