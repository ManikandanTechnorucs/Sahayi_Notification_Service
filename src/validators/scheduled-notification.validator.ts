import { z } from 'zod';
import { VALIDATION_LIMITS } from '../constants/validation.constants';

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
          .max(VALIDATION_LIMITS.TITLE_MAX, `title must be at most ${VALIDATION_LIMITS.TITLE_MAX} characters`),
        message: z
          .string()
          .trim()
          .min(1, 'message is required')
          .max(VALIDATION_LIMITS.MESSAGE_MAX, `message must be at most ${VALIDATION_LIMITS.MESSAGE_MAX} characters`),
        scheduledAt: z.coerce.date().refine(
          (value) => value.getTime() >= Date.now() - VALIDATION_LIMITS.SCHEDULED_AT_PAST_TOLERANCE_MS,
          {
            message: 'scheduledAt must not be more than 5 seconds in the past',
          },
        ),
        childReminderId: z.coerce
          .number()
          .int()
          .positive({ message: 'childReminderId must be a positive integer' })
          .optional(),
        notificationType: z
          .string()
          .trim()
          .min(1, 'notificationType must not be empty')
          .max(
            VALIDATION_LIMITS.NOTIFICATION_TYPE_MAX,
            `notificationType must be at most ${VALIDATION_LIMITS.NOTIFICATION_TYPE_MAX} characters`,
          )
          .optional(),
        clientEventId: z
          .string()
          .trim()
          .min(
            VALIDATION_LIMITS.CLIENT_EVENT_ID_MIN,
            `clientEventId must be at least ${VALIDATION_LIMITS.CLIENT_EVENT_ID_MIN} characters`,
          )
          .max(
            VALIDATION_LIMITS.CLIENT_EVENT_ID_MAX,
            `clientEventId must be at most ${VALIDATION_LIMITS.CLIENT_EVENT_ID_MAX} characters`,
          )
          .optional(),
        screen: z
          .string()
          .trim()
          .min(1, 'screen must not be empty')
          .max(
            VALIDATION_LIMITS.SCREEN_MAX,
            `screen must be at most ${VALIDATION_LIMITS.SCREEN_MAX} characters`,
          )
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
        .max(
          VALIDATION_LIMITS.DELIVERED_LIST_LIMIT_MAX,
          `limit must be at most ${VALIDATION_LIMITS.DELIVERED_LIST_LIMIT_MAX}`,
        )
        .default(30),
    })
    .strict(),
};

/**
 * Request body for bulk marking delivered notifications as read.
 */
export const bulkMarkDeliveredReadSchema = {
  body: z
    .object({
      ids: z
        .array(
          z.coerce.number().int().positive({
            message: 'each id must be a positive integer',
          }),
        )
        .min(1, 'ids must contain at least one id')
        .max(
          VALIDATION_LIMITS.BULK_READ_IDS_MAX,
          `ids must contain at most ${VALIDATION_LIMITS.BULK_READ_IDS_MAX} items`,
        ),
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

export const cancelByUserParamsSchema = {
  params: z
    .object({
      userId: z
        .string()
        .trim()
        .regex(/^\d+$/, 'userId must be a positive integer')
        .refine((value) => BigInt(value) > 0n, {
          message: 'userId must be a positive integer',
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

export type BulkMarkDeliveredReadBody = z.infer<typeof bulkMarkDeliveredReadSchema.body>;
