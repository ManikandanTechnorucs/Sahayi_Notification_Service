import { z } from 'zod';

export const notificationPayloadSchema = z.object({
  module: z.string().min(1),
  eventType: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  channels: z.array(z.string()).min(1),
  sourceEntityId: z.string().optional(),
  data: z.record(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const serviceBusNotificationMessageSchema = z.object({
  messageId: z.string().uuid(),
  correlationId: z.string().optional(),
  eventType: z.string().min(1),
  payload: notificationPayloadSchema,
  createdAt: z.string().optional(),
  sourceSystem: z.string().optional(),
  retryCount: z.number().int().min(0).optional(),
  scheduledAt: z.string().optional(),
});

export const failedDeviceRefSchema = z.object({
  userDeviceTokenId: z.string().min(1),
  fcmToken: z.string().min(1),
});

export const retryMessageSchema = z.object({
  originalMessageId: z.string().uuid(),
  retryCount: z.number().int().min(1),
  failedDevices: z.array(failedDeviceRefSchema).min(1),
  payload: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    data: z.record(z.string()),
    userId: z.string().optional(),
    eventType: z.string().optional(),
    module: z.string().optional(),
  }),
});

export type ValidatedServiceBusMessage = z.infer<typeof serviceBusNotificationMessageSchema>;
export type ValidatedRetryMessage = z.infer<typeof retryMessageSchema>;
