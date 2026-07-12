import { NotificationService } from './notification.service';
import {
  NOTIFICATION_LOG_STATUS,
  ServiceBusNotificationMessage,
} from '../types/notification.types';

const baseMessage: ServiceBusNotificationMessage = {
  messageId: '2ea47ef8-ced4-47db-81f7-e3041a4ef431',
  correlationId: '2ea47ef8-ced4-47db-81f7-e3041a4ef431',
  eventType: 'notification.dispatch',
  payload: {
    module: 'reminder',
    eventType: 'reminder.before',
    userId: '7',
    title: 'Tomorrow testing release',
    body: 'Upcoming: Release sahayii demo app',
    channels: ['push'],
    sourceEntityId: '4',
    data: {
      childReminderId: '4',
      phase: 'before',
    },
  },
  retryCount: 0,
};

function createMocks() {
  const notificationRepository = {
    findByMessageId: jest.fn().mockResolvedValue(null),
    createNotificationLog: jest.fn().mockResolvedValue({ Id: 1 }),
    updateNotificationLogStatus: jest.fn().mockResolvedValue(undefined),
    createDeliveryRecords: jest.fn().mockResolvedValue(undefined),
    updateDeliveryStatus: jest.fn().mockResolvedValue(undefined),
    isReminderNotificationCompleted: jest.fn().mockResolvedValue(false),
    markReminderPhaseCompleted: jest.fn().mockResolvedValue(undefined),
  };

  const deviceService = {
    getActiveDevicesForUser: jest.fn().mockResolvedValue([
      { id: 1, userId: '7', fcmToken: 'token-a', deviceId: null, platform: 'android' },
      { id: 2, userId: '7', fcmToken: 'token-b', deviceId: null, platform: 'ios' },
    ]),
    getActiveDevicesByIds: jest.fn(),
    deactivateInvalidToken: jest.fn().mockResolvedValue(undefined),
  };

  const fcmService = {
    sendToDevices: jest.fn().mockResolvedValue([
      { userDeviceTokenId: 1, fcmToken: 'token-a', success: true, isPermanentFailure: false },
      {
        userDeviceTokenId: 2,
        fcmToken: 'token-b',
        success: false,
        isPermanentFailure: false,
        errorMessage: 'network error',
      },
    ]),
  };

  const retryQueueService = {
    enqueueRetry: jest.fn().mockResolvedValue(undefined),
  };

  const service = new NotificationService(
    notificationRepository as never,
    deviceService as never,
    fcmService as never,
    retryQueueService as never,
    3
  );

  return {
    service,
    notificationRepository,
    deviceService,
    fcmService,
    retryQueueService,
  };
}

describe('NotificationService', () => {
  it('skips duplicate messages', async () => {
    const { service, notificationRepository } = createMocks();
    notificationRepository.findByMessageId.mockResolvedValue({ Id: 99 });

    const result = await service.processDispatchMessage(baseMessage);

    expect(result.action).toBe('skipped_duplicate');
    expect(notificationRepository.createNotificationLog).not.toHaveBeenCalled();
  });

  it('skips when reminder is already completed', async () => {
    const { service, notificationRepository } = createMocks();
    notificationRepository.isReminderNotificationCompleted.mockResolvedValue(true);

    const result = await service.processDispatchMessage(baseMessage);

    expect(result.action).toBe('skipped_completed');
    expect(notificationRepository.createNotificationLog).toHaveBeenCalledWith(
      baseMessage,
      NOTIFICATION_LOG_STATUS.SKIPPED
    );
  });

  it('marks reminder complete when any device succeeds', async () => {
    const { service, notificationRepository, retryQueueService } = createMocks();

    const result = await service.processDispatchMessage(baseMessage);

    expect(result.action).toBe('processed');
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(notificationRepository.markReminderPhaseCompleted).toHaveBeenCalledWith(
      4,
      baseMessage.payload
    );
    expect(retryQueueService.enqueueRetry).toHaveBeenCalled();
  });

  it('deactivates invalid tokens without retry', async () => {
    const mocks = createMocks();
    mocks.fcmService.sendToDevices.mockResolvedValue([
      {
        userDeviceTokenId: 1,
        fcmToken: 'bad-token',
        success: false,
        isPermanentFailure: true,
        errorCode: 'messaging/invalid-registration-token',
      },
    ]);
    mocks.deviceService.getActiveDevicesForUser.mockResolvedValue([
      { id: 1, userId: '7', fcmToken: 'bad-token', deviceId: null, platform: 'android' },
    ]);

    await mocks.service.processDispatchMessage(baseMessage);

    expect(mocks.deviceService.deactivateInvalidToken).toHaveBeenCalledWith(1);
    expect(mocks.retryQueueService.enqueueRetry).not.toHaveBeenCalled();
    expect(mocks.notificationRepository.markReminderPhaseCompleted).not.toHaveBeenCalled();
  });
});
