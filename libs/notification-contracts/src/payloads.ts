/**
 * Supported notification delivery channels (extensible).
 */
export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

/**
 * Source modules that can publish notification events.
 */
export type NotificationSourceModule = 'reminder' | 'auth' | 'business' | string;

/**
 * Generic payload published to the notification queue.
 * Business modules map their domain data into this shape.
 */
export type NotificationDispatchPayload = {
  module: NotificationSourceModule;
  eventType: string;
  userId: string;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  data?: Record<string, string>;
  metadata?: Record<string, string>;
  sourceEntityId?: string;
};
