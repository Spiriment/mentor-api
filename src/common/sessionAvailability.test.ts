import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availabilityWindows,
  dayRange,
  fitsAvailability,
  generateSlots,
  type AvailabilityRecord,
} from './sessionAvailability';

// Tuesday 2026-11-03. Lagos is UTC+1 all year; London is UTC+0 in November.
const lagosTuesday: AvailabilityRecord = {
  dayOfWeek: 2,
  isRecurring: true,
  startTime: '09:00:00',
  endTime: '17:00:00',
  timezone: 'Africa/Lagos',
};
const now = new Date('2026-10-27T12:00:00Z');

function slotsFor(
  records: AvailabilityRecord[],
  date: string,
  viewerTz: string,
  slotMinutes = 60,
  busy: { start: Date; end: Date }[] = [],
) {
  const range = dayRange(date, viewerTz);
  const windows = availabilityWindows(records, range.start, range.end);
  return generateSlots({
    windows,
    slotMinutes,
    busy,
    rangeStart: range.start,
    rangeEnd: range.end,
    displayTimeZone: viewerTz,
    now,
  });
}

describe('session availability across time zones', () => {
  it("shows a Lagos mentor's 09:00–17:00 as 09:00–16:00 starts to a Lagos mentee", () => {
    const slots = slotsFor([lagosTuesday], '2026-11-03', 'Africa/Lagos');
    assert.deepEqual(
      slots.map((s) => s.time),
      ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
    );
    assert.equal(slots[0].startsAt, '2026-11-03T08:00:00.000Z');
  });

  it('shows the same hours shifted for a London mentee', () => {
    const slots = slotsFor([lagosTuesday], '2026-11-03', 'Europe/London');
    assert.equal(slots[0].time, '08:00');
    assert.equal(slots[0].startsAt, '2026-11-03T08:00:00.000Z');
    assert.equal(slots.at(-1)!.time, '15:00');
  });

  it("puts a far-away mentee's slots on the right local day", () => {
    // 09:00 Lagos = 17:00 Tokyo the same day; nothing on Monday in Tokyo
    assert.equal(slotsFor([lagosTuesday], '2026-11-03', 'Asia/Tokyo')[0].time, '17:00');
    assert.equal(slotsFor([lagosTuesday], '2026-11-02', 'Asia/Tokyo').length, 0);
  });

  it('never offers a slot that runs past the end time (45-minute sessions)', () => {
    const slots = slotsFor([lagosTuesday], '2026-11-03', 'Africa/Lagos', 45);
    assert.equal(slots.at(-1)!.time, '15:45'); // ends 16:30; 16:30 would end 17:15
    const day = dayRange('2026-11-03', 'Africa/Lagos');
    const windows = availabilityWindows([lagosTuesday], day.start, day.end);
    for (const s of slots) {
      const start = new Date(s.startsAt);
      assert.ok(fitsAvailability(windows, start, new Date(start.getTime() + 45 * 60000)));
    }
  });

  it('marks a slot taken by an existing session (same instant, not shifted by the offset)', () => {
    const booked = {
      start: new Date('2026-11-03T08:00:00Z'), // 09:00 Lagos
      end: new Date('2026-11-03T09:00:00Z'),
    };
    const slots = slotsFor([lagosTuesday], '2026-11-03', 'Africa/Lagos', 60, [booked]);
    assert.equal(slots.find((s) => s.time === '09:00')!.available, false);
    assert.equal(slots.find((s) => s.time === '10:00')!.available, true);
  });

  it('respects breaks and past times', () => {
    const withLunch = { ...lagosTuesday, breaks: [{ startTime: '12:00', endTime: '13:00' }] };
    const slots = slotsFor([withLunch], '2026-11-03', 'Africa/Lagos');
    assert.equal(slots.find((s) => s.time === '12:00')!.available, false);
    const past = slotsFor([lagosTuesday], '2026-10-27', 'Africa/Lagos');
    assert.equal(past.find((s) => s.time === '09:00')!.available, false); // 08:00Z < now
    assert.equal(past.find((s) => s.time === '16:00')!.available, true);
  });

  it('adds one-off dated hours on top of the weekly hours', () => {
    const extra: AvailabilityRecord = {
      dayOfWeek: 2,
      isRecurring: false,
      specificDate: '2026-11-03',
      startTime: '18:00',
      endTime: '19:00',
      timezone: 'Africa/Lagos',
    };
    const times = slotsFor([lagosTuesday, extra], '2026-11-03', 'Africa/Lagos').map((s) => s.time);
    assert.ok(times.includes('09:00') && times.includes('18:00'));
  });

  it('follows daylight saving in the mentor zone', () => {
    const london: AvailabilityRecord = { ...lagosTuesday, timezone: 'Europe/London' };
    // Tuesday 2026-10-20 is BST (UTC+1); Tuesday 2026-11-03 is GMT (UTC+0)
    assert.equal(slotsFor([london], '2026-10-20', 'Europe/London')[0].startsAt, '2026-10-20T08:00:00.000Z');
    assert.equal(slotsFor([london], '2026-11-03', 'Europe/London')[0].startsAt, '2026-11-03T09:00:00.000Z');
  });

  it('fitsAvailability rejects a booking outside the hours or across a break', () => {
    const withLunch = { ...lagosTuesday, breaks: [{ startTime: '12:00', endTime: '13:00' }] };
    const day = dayRange('2026-11-03', 'Africa/Lagos');
    const windows = availabilityWindows([withLunch], day.start, day.end);
    const at = (iso: string, mins: number) => [new Date(iso), new Date(new Date(iso).getTime() + mins * 60000)] as const;
    assert.equal(fitsAvailability(windows, ...at('2026-11-03T08:00:00Z', 60)), true); // 09:00 Lagos
    assert.equal(fitsAvailability(windows, ...at('2026-11-03T07:00:00Z', 60)), false); // 08:00 Lagos
    assert.equal(fitsAvailability(windows, ...at('2026-11-03T15:30:00Z', 60)), false); // ends 17:30
    assert.equal(fitsAvailability(windows, ...at('2026-11-03T10:30:00Z', 60)), false); // over lunch
  });
});
