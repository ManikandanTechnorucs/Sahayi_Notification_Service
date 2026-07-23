/**
 * DTO shapes for scheduled notification APIs (Swagger / OpenAPI examples).
 */
export type CreateScheduledNotificationDto = {
  userId: number;
  title: string;
  message: string;
  /** ISO-8601 date/time when the notification should be delivered */
  scheduledAt: string;
};

export type ScheduledNotificationResponseDto = {
  id: string;
  userId: string;
  deviceToken: string | null;
  title: string;
  message: string;
  status: string;
  azureMessageId: string | null;
  scheduledAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type DeliveredNotificationResponseDto = {
  id: string;
  scheduledNotificationId: string;
  userId: string;
  title: string;
  message: string;
  deliveredAt: string;
  readAt: string | null;
  isRead: boolean;
  createdAt: string;
};
