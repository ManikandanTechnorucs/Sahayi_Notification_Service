import {
  combineReminderDateAndTime,
  getUtcDatePadRange,
  getUtcFireWindow,
} from '../reminder-schedule-time.util';

describe('combineReminderDateAndTime', () => {
  it('treats stored DATE + TIME as UTC, not a regional wall clock', () => {
    const reminderDate = new Date(Date.UTC(2026, 7, 20));
    const reminderTime = new Date(Date.UTC(1970, 0, 1, 10, 30, 0));

    expect(combineReminderDateAndTime(reminderDate, reminderTime).toISOString()).toBe(
      '2026-08-20T10:30:00.000Z',
    );
  });

  it('does not re-apply  when 8:00 AM IST was stored as 02:30 UTC', () => {
    const reminderDate = new Date(Date.UTC(2026, 7, 20));
    const reminderTime = new Date(Date.UTC(1970, 0, 1, 2, 30, 0));
    const fireAt = combineReminderDateAndTime(reminderDate, reminderTime);

    expect(fireAt.toISOString()).toBe('2026-08-20T02:30:00.000Z');
    expect(fireAt.toISOString()).not.toBe('2026-08-19T21:00:00.000Z');
  });
});

describe('getUtcFireWindow', () => {
  it('uses a now–1h … now+36h window', () => {
    const reference = new Date('2026-08-20T12:00:00.000Z');
    const { windowStart, windowEnd } = getUtcFireWindow(reference);

    expect(windowStart.toISOString()).toBe('2026-08-20T11:00:00.000Z');
    expect(windowEnd.toISOString()).toBe('2026-08-22T00:00:00.000Z');
  });
});

describe('getUtcDatePadRange', () => {
  it('pads adjacent UTC calendar days around the fire window', () => {
    const windowStart = new Date('2026-08-20T11:00:00.000Z');
    const windowEnd = new Date('2026-08-22T00:00:00.000Z');
    const { dayStart, dayEnd } = getUtcDatePadRange(windowStart, windowEnd);

    expect(dayStart.toISOString()).toBe('2026-08-19T00:00:00.000Z');
    expect(dayEnd.toISOString()).toBe('2026-08-23T23:59:59.000Z');
  });
});
