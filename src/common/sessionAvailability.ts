import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * One source of truth for "when can this mentor be booked".
 *
 * A mentor's availability rows hold wall-clock times ("09:00"–"17:00") in the mentor's own
 * time zone (the row's `timezone`, set from their device). Everything here converts those
 * to real instants, so the slots shown to a mentee, the check at booking time and the
 * mentee's display all agree. Previously the slot list treated the hours as UTC, booking
 * treated them as the mentor's zone and the app treated them as the mentee's zone, so
 * slots were off by the zone offset (and already-booked slots showed as free) for anyone
 * not on UTC.
 */

export interface AvailabilityRecord {
  dayOfWeek: number; // 0 = Sunday, in the record's own time zone
  isRecurring: boolean;
  specificDate?: Date | string | null;
  startTime: string; // "HH:mm" or "HH:mm:ss"
  endTime: string;
  timezone?: string | null;
  breaks?: { startTime: string; endTime: string }[] | null;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AvailabilityWindow extends TimeRange {
  breaks: TimeRange[];
}

export interface Slot {
  /** Wall-clock "HH:mm" in the zone the slots were requested for */
  time: string;
  /** The exact start instant (ISO) — what the app should display and book */
  startsAt: string;
  available: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zoneOf(record: AvailabilityRecord): string {
  return isValidTimeZone(record.timezone) ? record.timezone : 'UTC';
}

function hhmmss(time: string): string {
  const [h = '00', m = '00', s = '00'] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

/** "YYYY-MM-DD" for a DATE column, whether the driver returned a string or a Date */
export function dateOnly(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar dates ("YYYY-MM-DD") in `tz` touched by [start, end], padded by a day each side */
function localDatesCovering(start: Date, end: Date, tz: string): string[] {
  const dates = new Set<string>();
  for (let t = start.getTime() - DAY_MS; t <= end.getTime() + DAY_MS; t += DAY_MS / 2) {
    dates.add(formatInTimeZone(new Date(t), tz, 'yyyy-MM-dd'));
  }
  return [...dates].sort();
}

function weekdayOf(date: string): number {
  // The weekday of a calendar date doesn't depend on the zone
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** A wall-clock time on a local date in `tz`, as an instant */
function instant(date: string, time: string, tz: string): Date {
  return fromZonedTime(`${date}T${hhmmss(time)}`, tz);
}

/**
 * The mentor's open windows that touch [rangeStart, rangeEnd). Recurring weekly rows and
 * one-off dated rows are combined (a dated row adds hours on that day).
 */
export function availabilityWindows(
  records: AvailabilityRecord[],
  rangeStart: Date,
  rangeEnd: Date,
): AvailabilityWindow[] {
  const windows: AvailabilityWindow[] = [];
  for (const record of records) {
    const tz = zoneOf(record);
    const dates = record.isRecurring
      ? localDatesCovering(rangeStart, rangeEnd, tz).filter(
          (d) => weekdayOf(d) === Number(record.dayOfWeek),
        )
      : record.specificDate
        ? [dateOnly(record.specificDate)]
        : [];

    for (const date of dates) {
      const start = instant(date, record.startTime, tz);
      let end = instant(date, record.endTime, tz);
      if (end <= start) end = new Date(end.getTime() + DAY_MS); // runs past midnight
      if (end <= rangeStart || start >= rangeEnd) continue;
      const breaks = (record.breaks ?? []).map((b) => ({
        start: instant(date, b.startTime, tz),
        end: instant(date, b.endTime, tz),
      }));
      windows.push({ start, end, breaks });
    }
  }
  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True if [start, end) sits inside one open window and avoids its breaks */
export function fitsAvailability(windows: AvailabilityWindow[], start: Date, end: Date): boolean {
  return windows.some(
    (w) =>
      start >= w.start &&
      end <= w.end &&
      !w.breaks.some((b) => rangesOverlap({ start, end }, b)),
  );
}

/**
 * Bookable slots starting within [rangeStart, rangeEnd). Every slot fits entirely inside a
 * window (the last one used to run past the mentor's end time and then fail to book).
 */
export function generateSlots(params: {
  windows: AvailabilityWindow[];
  slotMinutes: number;
  busy: TimeRange[];
  rangeStart: Date;
  rangeEnd: Date;
  displayTimeZone: string;
  now?: Date;
}): Slot[] {
  const { windows, slotMinutes, busy, rangeStart, rangeEnd, displayTimeZone } = params;
  const now = params.now ?? new Date();
  const stepMs = slotMinutes * 60 * 1000;
  const byStart = new Map<number, Slot>();

  for (const w of windows) {
    for (let t = w.start.getTime(); t + stepMs <= w.end.getTime(); t += stepMs) {
      const start = new Date(t);
      if (start < rangeStart || start >= rangeEnd) continue;
      const range = { start, end: new Date(t + stepMs) };
      const available =
        start > now &&
        !w.breaks.some((b) => rangesOverlap(range, b)) &&
        !busy.some((b) => rangesOverlap(range, b));
      const existing = byStart.get(t);
      if (!existing || (!existing.available && available)) {
        byStart.set(t, {
          time: formatInTimeZone(start, displayTimeZone, 'HH:mm'),
          startsAt: start.toISOString(),
          available,
        });
      }
    }
  }
  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
}

/** [start, end) of the calendar day `date` ("YYYY-MM-DD") in `tz` */
export function dayRange(date: string, tz: string): TimeRange {
  const start = fromZonedTime(`${date}T00:00:00`, tz);
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = fromZonedTime(`${next.toISOString().slice(0, 10)}T00:00:00`, tz);
  return { start, end };
}
