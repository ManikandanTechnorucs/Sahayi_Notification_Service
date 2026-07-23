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
        scheduledAt: z.coerce.date().refine((value) => value.getTime() > Date.now(), {
          message: 'scheduledAt must be in the future',
        }),
      })
      .strict(),
  ),
};

export type CreateScheduledNotificationBody = z.infer<
  typeof createScheduledNotificationSchema.body
>;
