import { z } from 'zod';

/**
 * Normalizes alternate payload keys (userID → userId).
 */
const normalizeCreateBody = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const body = value as Record<string, unknown>;

  if (body.userId === undefined && body.userID !== undefined) {
    return { ...body, userId: body.userID };
  }

  return body;
};

/**
 * Request body for creating a scheduled notification.
 */
export const createScheduledNotificationSchema = {
  body: z.preprocess(
    normalizeCreateBody,
    z
      .object({
        userId: z.coerce.number().int().positive({
          message: 'userId must be a positive integer',
        }),
        title: z
          .string()
          .trim()
          .min(1, 'title is required')
          .max(200, 'title must be at most 200 characters'),
        message: z
          .string()
          .trim()
          .min(1, 'message is required')
          .max(1000, 'message must be at most 1000 characters'),
        scheduledAt: z.coerce.date().refine((value) => value.getTime() >= Date.now() - 5000, {
          message: 'scheduledAt must not be more than 5 seconds in the past',
        }),
        childReminderId: z.coerce
          .number()
          .int()
          .positive({ message: 'childReminderId must be a positive integer' })
          .optional(),
        notificationType: z
          .string()
          .trim()
          .min(1, 'notificationType must not be empty')
          .max(50, 'notificationType must be at most 50 characters')
          .optional(),
        clientEventId: z
          .string()
          .trim()
          .min(8, 'clientEventId must be at least 8 characters')
          .max(64, 'clientEventId must be at most 64 characters')
          .optional(),
        screen: z
          .string()
          .trim()
          .min(1, 'screen must not be empty')
          .max(100, 'screen must be at most 100 characters')
          .optional(),
      })
      .strict(),
  ),
};

/**
 * Query params for listing delivered notifications.
 */
export const getDeliveredNotificationsQuerySchema = {
  query: z
    .object({
      page: z.coerce
        .number()
        .int('page must be an integer')
        .positive('page must be a positive integer')
        .default(1),
      limit: z.coerce
        .number()
        .int('limit must be an integer')
        .positive('limit must be a positive integer')
        .max(30, 'limit must be at most 30')
        .default(30),
    })
    .strict(),
};

export const cancelScheduledNotificationParamsSchema = {
  params: z
    .object({
      id: z
        .string()
        .trim()
        .regex(/^\d+$/, 'id must be a positive integer')
        .refine((value) => BigInt(value) > 0n, {
          message: 'id must be a positive integer',
        }),
    })
    .strict(),
};

export const cancelByChildReminderParamsSchema = {
  params: z
    .object({
      childReminderId: z
        .string()
        .trim()
        .regex(/^\d+$/, 'childReminderId must be a positive integer')
        .refine((value) => BigInt(value) > 0n, {
          message: 'childReminderId must be a positive integer',
        }),
    })
    .strict(),
};

export type CreateScheduledNotificationBody = z.infer<
  typeof createScheduledNotificationSchema.body
>;

export type GetDeliveredNotificationsQuery = z.infer<
  typeof getDeliveredNotificationsQuerySchema.query
>;
