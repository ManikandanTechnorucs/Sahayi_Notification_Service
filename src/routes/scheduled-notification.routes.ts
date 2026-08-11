import { Router } from 'express';
import { validate } from '../../libs/validation/src/validate';
import { requireAuth } from '../middlewares/auth.middleware';
import type { ScheduledNotificationController } from '../controllers/scheduled-notification.controller';
import {
  bulkMarkDeliveredReadSchema,
  cancelByChildReminderParamsSchema,
  cancelScheduledNotificationParamsSchema,
  createScheduledNotificationSchema,
  getDeliveredNotificationsQuerySchema,
} from '../validators/scheduled-notification.validator';

/**
 * Routes for scheduled notification APIs.
 */
export function createScheduledNotificationRoutes(
  controller: ScheduledNotificationController,
): Router {
  const router = Router();

  router.post(
    '/schedule-notification',
    requireAuth,
    validate(createScheduledNotificationSchema),
    controller.create,
  );

  router.post('/sync-today-reminders', requireAuth, controller.syncTodayReminders);

  router.delete(
    '/schedule-notification/by-child-reminder/:childReminderId',
    requireAuth,
    validate(cancelByChildReminderParamsSchema),
    controller.cancelByChildReminder,
  );

  router.delete(
    '/schedule-notification/:id',
    requireAuth,
    validate(cancelScheduledNotificationParamsSchema),
    controller.cancel,
  );

  router.get(
    '/delivered-notification/unread-count',
    requireAuth,
    controller.getUnreadDeliveredCount,
  );

  router.patch(
    '/delivered-notification/mark-read',
    requireAuth,
    validate(bulkMarkDeliveredReadSchema),
    controller.bulkMarkDeliveredAsRead,
  );

  router.get(
    '/delivered-notification',
    requireAuth,
    validate(getDeliveredNotificationsQuerySchema),
    controller.getDelivered,
  );

  return router;
}
