/**
 * Domain notification types stored on ScheduledNotification.NotificationType.
 * Reminder types remain owned by reminder-notification.constants.ts.
 */
export const APP_NOTIFICATION_TYPES = {
  LOGIN: 'Login',
  REGISTRATION: 'Registration',
  CAREGIVER_REQUEST: 'CaregiverRequest',
  CAREGIVER_REQUEST_ACCEPTED: 'CaregiverRequestAccepted',
  CAREGIVER_REQUEST_REJECTED: 'CaregiverRequestRejected',
  CARE_RECIPIENT_REQUEST: 'CareRecipientRequest',
  CARE_RECIPIENT_REQUEST_ACCEPTED: 'CareRecipientRequestAccepted',
  CARE_RECIPIENT_REQUEST_REJECTED: 'CareRecipientRequestRejected',
  FALL_DETECTED: 'FallDetected',
  FALL_EMERGENCY: 'FallEmergency',
  SOS_EMERGENCY: 'SosEmergency',
} as const;

export type AppNotificationType =
  (typeof APP_NOTIFICATION_TYPES)[keyof typeof APP_NOTIFICATION_TYPES];

/**
 * When scheduledAt is within this window of "now", enqueue immediately via
 * sendMessages instead of Azure scheduleMessages.
 */
export const IMMEDIATE_NOTIFICATION_THRESHOLD_MS = 10_000;
