export const REMINDER_NOTIFICATION_TYPES = {
  BEFORE: 'ReminderBefore',
  ON_TIME: 'ReminderOnTime',
  MISSED: 'ReminderMissed',
} as const;

export const REMINDER_NOTIFICATION_TYPE_VALUES = Object.values(REMINDER_NOTIFICATION_TYPES);

/** Caregiver fan-out after a user missed reminder. Not a user reminder phase. */
export const CAREGIVER_REMINDER_MISSED_TYPE = 'CaregiverReminderMissed';

export type ReminderNotificationType =
  (typeof REMINDER_NOTIFICATION_TYPES)[keyof typeof REMINDER_NOTIFICATION_TYPES];

export const ACTIVE_SCHEDULE_STATUSES = ['SCHEDULED', 'PROCESSING', 'FAILED'] as const;

/** Phases whose fire time is more than this many ms in the past are not created during sync. */
export const REMINDER_SYNC_PAST_PHASE_SKIP_MS = 60_000;

/** Reconcile schedules when desired time differs from stored ScheduledAt by more than this. */
export const REMINDER_SYNC_TIME_DRIFT_MS = 30_000;
