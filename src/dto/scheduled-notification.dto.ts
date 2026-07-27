/**
 * DTO shapes for scheduled notification APIs (Swagger / OpenAPI examples).
 */
export type CreateScheduledNotificationDto = {
  userId: number;
  title: string;
  message: string;
  /** ISO-8601 date/time when the notification should be delivered */
  scheduledAt: string;
  childReminderId?: number;
  notificationType?: string;
};

export type ScheduledNotificationResponseDto = {
  id: string;
  userId: string;
  childReminderId: string | null;
  notificationType: string | null;
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

export type DeliveredScheduledNotificationSummaryDto = {
  id: string;
  userId: string;
  childReminderId: string | null;
  notificationType: string | null;
  title: string;
  message: string;
  status: string;
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
  scheduledNotification: DeliveredScheduledNotificationSummaryDto | null;
};

export type DeliveredNotificationListResult = {
  items: DeliveredNotificationResponseDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
