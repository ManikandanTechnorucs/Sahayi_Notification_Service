/**
 * Reminder DATE + TIME columns are stored as UTC.
 * Fire times are absolute UTC instants — no hardcoded regional timezone.
 */

import { REMINDER_SYNC_FIRE_WINDOW } from '../constants/validation.constants';

/**
 * Combines a stored UTC DATE and UTC TIME into an absolute fire instant.
 */
export function combineReminderDateAndTime(reminderDate: Date, reminderTime: Date): Date {
  return new Date(
    Date.UTC(
      reminderDate.getUTCFullYear(),
      reminderDate.getUTCMonth(),
      reminderDate.getUTCDate(),
      reminderTime.getUTCHours(),
      reminderTime.getUTCMinutes(),
      reminderTime.getUTCSeconds(),
    ),
  );
}

export function getUtcFireWindow(
  reference: Date = new Date(),
  lookBehindMs = REMINDER_SYNC_FIRE_WINDOW.LOOK_BEHIND_MS,
  lookAheadMs = REMINDER_SYNC_FIRE_WINDOW.LOOK_AHEAD_MS,
): { windowStart: Date; windowEnd: Date } {
  return {
    windowStart: new Date(reference.getTime() - lookBehindMs),
    windowEnd: new Date(reference.getTime() + lookAheadMs),
  };
}

/** DATE-column pad around a UTC fire window so children on adjacent calendar days are included. */
export function getUtcDatePadRange(windowStart: Date, windowEnd: Date): {
  dayStart: Date;
  dayEnd: Date;
} {
  return {
    dayStart: new Date(
      Date.UTC(
        windowStart.getUTCFullYear(),
        windowStart.getUTCMonth(),
        windowStart.getUTCDate() - 1,
      ),
    ),
    dayEnd: new Date(
      Date.UTC(
        windowEnd.getUTCFullYear(),
        windowEnd.getUTCMonth(),
        windowEnd.getUTCDate() + 1,
        23,
        59,
        59,
      ),
    ),
  };
}

/**
 * Ensures Azure scheduled enqueue time is slightly in the future.
 */
export function resolveScheduledEnqueueTime(
  scheduledAt: Date,
  leadMs = REMINDER_SYNC_FIRE_WINDOW.ENQUEUE_LEAD_MS,
): Date {
  const minimum = Date.now() + leadMs;

  if (scheduledAt.getTime() < minimum) {
    return new Date(minimum);
  }

  return scheduledAt;
}
