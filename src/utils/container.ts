import { createMessagingInfrastructure } from '../../libs/messaging/src/index';
import { ChildReminderRepository } from '../repositories/child-reminder.repository';
import { ScheduledNotificationRepository } from '../repositories/scheduled-notification.repository';
import { ReminderScheduleSyncService } from '../services/reminder-schedule-sync.service';
import { ScheduledNotificationService } from '../services/scheduled-notification.service';
import { ScheduledNotificationController } from '../controllers/scheduled-notification.controller';

/**
 * Application composition root — wires repositories, services, and messaging.
 */
export function createContainer() {
  const messaging = createMessagingInfrastructure();
  const childReminderRepository = new ChildReminderRepository();
  const scheduledNotificationRepository = new ScheduledNotificationRepository();
  const scheduledNotificationService = new ScheduledNotificationService(
    scheduledNotificationRepository,
    messaging,
  );
  const reminderScheduleSyncService = new ReminderScheduleSyncService(
    childReminderRepository,
    scheduledNotificationRepository,
    scheduledNotificationService,
  );
  const scheduledNotificationController = new ScheduledNotificationController(
    scheduledNotificationService,
    reminderScheduleSyncService,
  );

  return {
    messaging,
    scheduledNotificationController,
    reminderScheduleSyncService,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
