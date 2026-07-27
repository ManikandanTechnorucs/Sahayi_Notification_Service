import { config } from '../../libs/config/src/config';

/**
 * Reminder DATE columns are stored as UTC midnight for the calendar day.
 * Reminder TIME columns store wall-clock HH:mm:ss as UTC time components
 * (see Reminder Service parseReminderTime) so MySQL TIME does not shift.
 *
 * Fire times are interpreted as wall-clock in REMINDER_TIMEZONE (default Asia/Kolkata),
 * never via Date#getHours()/setHours() on UTC-stored values.
 */

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readZonedParts(instant: Date, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );

  let hour = Number(parts.hour);
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * Converts a wall-clock date/time in `timeZone` to an absolute UTC Date.
 */
export function zonedWallClockToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuessMs = Date.UTC(year, monthIndex, day, hour, minute, second);
  const zoned = readZonedParts(new Date(utcGuessMs), timeZone);
  const asIfUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  const offsetMs = asIfUtcMs - utcGuessMs;

  return new Date(utcGuessMs - offsetMs);
}

/**
 * Combines a calendar DATE and wall-clock TIME into an absolute fire instant.
 */
export function combineReminderDateAndTime(reminderDate: Date, reminderTime: Date): Date {
  return zonedWallClockToUtc(
    reminderDate.getUTCFullYear(),
    reminderDate.getUTCMonth(),
    reminderDate.getUTCDate(),
    reminderTime.getUTCHours(),
    reminderTime.getUTCMinutes(),
    reminderTime.getUTCSeconds(),
    config.REMINDER_TIMEZONE,
  );
}

/**
 * Returns UTC-midnight bounds for "today" in REMINDER_TIMEZONE.
 * Matches how ChildReminder.ReminderDate is stored and queried.
 */
export function getLocalDayRange(reference: Date = new Date()): { dayStart: Date; dayEnd: Date } {
  const zoned = readZonedParts(reference, config.REMINDER_TIMEZONE);
  const dayStart = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day, 0, 0, 0, 0));
  const dayEnd = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day, 23, 59, 59, 999));

  return { dayStart, dayEnd };
}

/**
 * Ensures Azure scheduled enqueue time is slightly in the future.
 */
export function resolveScheduledEnqueueTime(scheduledAt: Date, leadMs = 2000): Date {
  const minimum = Date.now() + leadMs;

  if (scheduledAt.getTime() < minimum) {
    return new Date(minimum);
  }

  return scheduledAt;
}
