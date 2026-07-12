export const REMINDER_PHASES = {
  BEFORE: 'reminder.before',
  ON_TIME: 'reminder.on-time',
  AFTER: 'reminder.after',
} as const;

export type ReminderPhase = (typeof REMINDER_PHASES)[keyof typeof REMINDER_PHASES];

export const NOTIFICATION_EVENT_TYPES = {
  DISPATCH: 'notification.dispatch',
} as const;

export const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  INVALID_TOKEN: 'INVALID_TOKEN',
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const NOTIFICATION_LOG_STATUS = {
  PROCESSING: 'PROCESSING',
  DELIVERED: 'DELIVERED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export const FCM_PERMANENT_ERROR_CODES = [
  'registration-token-not-registered',
  'invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
] as const;

export interface NotificationPayloadData {
  childReminderId?: string;
  masterReminderId?: string;
  reminderDate?: string;
  reminderTime?: string;
  categoryLabel?: string;
  frequencyLabel?: string;
  phase?: string;
  [key: string]: string | undefined;
}

export interface NotificationPayload {
  module: string;
  eventType: string;
  userId: string;
  title: string;
  body: string;
  channels: string[];
  sourceEntityId?: string;
  data?: NotificationPayloadData;
  metadata?: Record<string, unknown>;
}

export interface ServiceBusNotificationMessage {
  messageId: string;
  correlationId?: string;
  eventType: string;
  payload: NotificationPayload;
  createdAt?: string;
  sourceSystem?: string;
  retryCount?: number;
  scheduledAt?: string;
}

export interface FailedDeviceRef {
  userDeviceTokenId: string;
  fcmToken: string;
}

export interface RetryMessage {
  originalMessageId: string;
  retryCount: number;
  failedDevices: FailedDeviceRef[];
  payload: {
    title: string;
    body: string;
    data: Record<string, string>;
    userId?: string;
    eventType?: string;
    module?: string;
  };
}

export interface DeviceSendResult {
  userDeviceTokenId: number;
  fcmToken: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  isPermanentFailure: boolean;
}

export interface ActiveDevice {
  id: number;
  userId: string;
  fcmToken: string;
  deviceId: string | null;
  platform: string | null;
}
