/**
 * Scheduled notification status constants — re-exports Prisma enum and status groups.
 */

export { ScheduledNotificationStatus } from '../../generated/prisma/enums';

export type { ScheduledNotificationStatus as ScheduledNotificationStatusType } from '../../generated/prisma/enums';

import { ScheduledNotificationStatus } from '../../generated/prisma/enums';

export const ACTIVE_SCHEDULE_STATUSES = [
  ScheduledNotificationStatus.SCHEDULED,
  ScheduledNotificationStatus.PROCESSING,
  ScheduledNotificationStatus.FAILED,
] as const;

export const TERMINAL_SCHEDULE_STATUSES = [
  ScheduledNotificationStatus.DELIVERED,
  ScheduledNotificationStatus.SENT,
  ScheduledNotificationStatus.CANCELLED,
] as const;

export const ERROR_MESSAGE_MAX_LENGTH = 1000;
