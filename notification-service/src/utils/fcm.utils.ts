import { FCM_PERMANENT_ERROR_CODES } from '../types/notification.types';

export function isPermanentFcmError(errorCode?: string): boolean {
  if (!errorCode) {
    return false;
  }

  const normalized = errorCode.toLowerCase();
  return FCM_PERMANENT_ERROR_CODES.some((code) => normalized.includes(code.toLowerCase()));
}

export function stringifyDataPayload(
  data?: Record<string, string | undefined>
): Record<string, string> {
  if (!data) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
}

export function getReminderPhaseField(
  eventType: string
): 'BeforeNotificationSent' | 'OnTimeNotificationSent' | 'AfterNotificationSent' | null {
  switch (eventType) {
    case 'reminder.before':
      return 'BeforeNotificationSent';
    case 'reminder.on-time':
      return 'OnTimeNotificationSent';
    case 'reminder.after':
      return 'AfterNotificationSent';
    default:
      return null;
  }
}

export function parseChildReminderId(data?: Record<string, string | undefined>): number | null {
  const raw = data?.childReminderId;
  if (!raw) {
    return null;
  }

  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
