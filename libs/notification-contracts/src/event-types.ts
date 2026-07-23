/**
 * Azure Service Bus envelope event types for the notification pipeline.
 */
export const NotificationEventTypes = {
  /** Generic dispatch — consumed by notification-service for any module */
  DISPATCH: 'notification.dispatch',
  /** Scheduled notification module: fire at ScheduledAt */
  SCHEDULED: 'notification.scheduled',
  /** Reminder module: 5 minutes before due time */
  REMINDER_BEFORE: 'reminder.before',
  /** Reminder module: fired when a reminder reaches its scheduled date/time */
  REMINDER_DUE: 'reminder.due',
  /** Reminder module: 5 minutes after due — triggers missed check */
  REMINDER_AFTER: 'reminder.after',
  /** Reminder module: push when reminder was missed */
  REMINDER_MISSED: 'reminder.missed',
} as const;
