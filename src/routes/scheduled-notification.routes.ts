import { Router } from 'express';
import { validate } from '../../libs/validation/src/validate';
import { requireAuth } from '../middlewares/auth.middleware';
import type { ScheduledNotificationController } from '../controllers/scheduled-notification.controller';
import { createScheduledNotificationSchema } from '../validators/scheduled-notification.validator';

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

  router.get('/delivered-notification', requireAuth, controller.getDelivered);

  return router;
}
