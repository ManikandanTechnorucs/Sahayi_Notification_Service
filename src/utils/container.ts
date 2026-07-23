import { createMessagingInfrastructure } from '../../libs/messaging/src/index';
import { ScheduledNotificationRepository } from '../repositories/scheduled-notification.repository';
import { ScheduledNotificationService } from '../services/scheduled-notification.service';
import { ScheduledNotificationController } from '../controllers/scheduled-notification.controller';

/**
 * Application composition root — wires repositories, services, and messaging.
 */
export function createContainer() {
  const messaging = createMessagingInfrastructure();
  const scheduledNotificationRepository = new ScheduledNotificationRepository();
  const scheduledNotificationService = new ScheduledNotificationService(
    scheduledNotificationRepository,
    messaging,
  );
  const scheduledNotificationController = new ScheduledNotificationController(
    scheduledNotificationService,
  );

  return {
    messaging,
    scheduledNotificationController,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
