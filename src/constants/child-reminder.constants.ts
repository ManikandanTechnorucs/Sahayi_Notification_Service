/**
 * Child reminder status names (statusmaster.StatusName).
 */

export const CHILD_REMINDER_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
} as const;

export type ChildReminderStatusName =
  (typeof CHILD_REMINDER_STATUS)[keyof typeof CHILD_REMINDER_STATUS];
