/**
 * Pure helpers behind the church portal's Insights charts (no database access, so they're unit
 * tested). Weeks start on Monday and are keyed by their start date (YYYY-MM-DD, UTC).
 */

const DAY_MS = 86_400_000;

/** Monday 00:00 UTC of the week containing `date` */
export function weekStartUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - offset * DAY_MS);
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The last `count` week starts, oldest first, ending with the current week */
export function lastWeekStarts(count: number, now: Date = new Date()): string[] {
  const current = weekStartUtc(now).getTime();
  return Array.from({ length: count }, (_, i) => isoDay(new Date(current - (count - 1 - i) * 7 * DAY_MS)));
}

/** The last `count` months as YYYY-MM, oldest first, ending with the current month */
export function lastMonths(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export type SessionLike = { scheduledAt: Date | string; status: string };

/**
 * Completed and cancelled sessions per week. No-shows count as cancelled (the session didn't
 * happen); scheduled/confirmed sessions aren't counted, they haven't happened yet.
 */
export function sessionsByWeek(sessions: SessionLike[], weeks: string[]) {
  const rows = new Map(weeks.map((w) => [w, { weekStart: w, completed: 0, cancelled: 0 }]));
  for (const s of sessions) {
    const key = isoDay(weekStartUtc(new Date(s.scheduledAt)));
    const row = rows.get(key);
    if (!row) continue;
    if (s.status === 'completed') row.completed++;
    else if (s.status === 'cancelled' || s.status === 'no_show') row.cancelled++;
  }
  return weeks.map((w) => rows.get(w)!);
}

/**
 * Bible reading per week from each member's monthlyStreakData ({ 'YYYY-MM': [day numbers read] }):
 * how many members read at least once that week, and how many reading days they logged in total.
 */
export function readingByWeek(monthlyStreakData: Array<Record<string, number[]> | null | undefined>, weeks: string[]) {
  const readers = new Map(weeks.map((w) => [w, 0]));
  const days = new Map(weeks.map((w) => [w, 0]));
  for (const months of monthlyStreakData) {
    if (!months || typeof months !== 'object') continue;
    const weeksForMember = new Set<string>();
    for (const [month, dayList] of Object.entries(months)) {
      if (!/^\d{4}-\d{2}$/.test(month) || !Array.isArray(dayList)) continue;
      const [y, m] = month.split('-').map(Number);
      for (const day of new Set(dayList)) {
        if (!Number.isInteger(day) || day < 1 || day > 31) continue;
        const date = new Date(Date.UTC(y, m - 1, day));
        if (date.getUTCMonth() !== m - 1) continue; // e.g. 31 in a 30-day month
        const key = isoDay(weekStartUtc(date));
        if (!days.has(key)) continue;
        days.set(key, days.get(key)! + 1);
        weeksForMember.add(key);
      }
    }
    for (const key of weeksForMember) readers.set(key, readers.get(key)! + 1);
  }
  return weeks.map((w) => ({ weekStart: w, readers: readers.get(w)!, readingDays: days.get(w)! }));
}

/** Members joined per month, plus the running total at the end of each month */
export function growthByMonth(joinDates: Array<Date | string>, months: string[]) {
  const joined = new Map(months.map((mo) => [mo, 0]));
  let before = 0;
  const first = months[0];
  for (const raw of joinDates) {
    const key = new Date(raw).toISOString().slice(0, 7);
    if (joined.has(key)) joined.set(key, joined.get(key)! + 1);
    else if (key < first) before++;
  }
  let total = before;
  return months.map((month) => {
    total += joined.get(month)!;
    return { month, joined: joined.get(month)!, total };
  });
}

/**
 * Member health by last activity: active (within 7 days), slipping (8–30 days), inactive (longer,
 * or never opened the app).
 */
export function memberHealth(lastActive: Array<Date | string | null | undefined>, now: Date = new Date()) {
  const result = { active: 0, slipping: 0, inactive: 0 };
  for (const raw of lastActive) {
    if (!raw) {
      result.inactive++;
      continue;
    }
    const days = (now.getTime() - new Date(raw).getTime()) / DAY_MS;
    if (days <= 7) result.active++;
    else if (days <= 30) result.slipping++;
    else result.inactive++;
  }
  return result;
}
