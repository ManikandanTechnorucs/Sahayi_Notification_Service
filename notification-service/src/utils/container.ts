import { getPrismaClient } from '../prisma/client';
import { DeviceRepository } from '../repositories/device.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { DeviceService } from '../services/device.service';
import { FcmService } from '../services/fcm.service';
import { NotificationService } from '../services/notification.service';
import { RetryQueueService } from '../services/retry-queue.service';

export interface AppContainer {
  notificationService: NotificationService;
  retryQueueService: RetryQueueService;
}

let container: AppContainer | undefined;

export function createContainer(): AppContainer {
  const prisma = getPrismaClient();

  const deviceRepository = new DeviceRepository(prisma);
  const notificationRepository = new NotificationRepository(prisma);

  const deviceService = new DeviceService(deviceRepository);
  const fcmService = new FcmService();
  const retryQueueService = new RetryQueueService(
    process.env.SERVICE_BUS_CONNECTION_STRING ?? '',
    process.env.SERVICE_BUS_RETRY_QUEUE_NAME ?? 'notification-retry'
  );

  const maxRetryCount = parseInt(process.env.MAX_RETRY_COUNT ?? '3', 10);

  const notificationService = new NotificationService(
    notificationRepository,
    deviceService,
    fcmService,
    retryQueueService,
    maxRetryCount
  );

  return {
    notificationService,
    retryQueueService,
  };
}

export function getContainer(): AppContainer {
  if (!container) {
    container = createContainer();
  }
  return container;
}

export function resetContainer(): void {
  container = undefined;
}
