jest.mock('../../../libs/logger/src/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { NotificationEventTypes } from '../../../libs/notification-contracts/src/index';
import { ScheduledNotificationService } from '../scheduled-notification.service';
import type { ScheduledNotificationRepository } from '../../repositories/scheduled-notification.repository';
import type { MessagingInfrastructure } from '../../../libs/messaging/src/index';

describe('ScheduledNotificationService voice audio', () => {
  const scheduledAt = new Date(Date.now() + 60 * 60_000);
  const audioUrl = 'https://cdn.example.com/voices/reminder-on-time.m4a';

  function buildRow(notificationAudioUrl: string | null) {
    return {
      Id: 42n,
      UserId: 7n,
      ChildReminderId: 9n,
      NotificationType: 'ReminderOnTime',
      DeviceToken: 'device-token',
      NotificationAudioUrl: notificationAudioUrl,
      Title: 'Medicine',
      Message: 'Take your tablet',
      Status: 'SCHEDULED',
      AzureMessageId: '9001',
      ScheduledAt: scheduledAt,
      SentAt: null,
      DeliveredAt: null,
      FailedAt: null,
      RetryCount: 0,
      ErrorMessage: null,
      CreatedAt: new Date('2026-07-18T10:00:00.000Z'),
      UpdatedAt: new Date('2026-07-18T10:00:00.000Z'),
    };
  }

  function buildService(notificationAudioUrl: string | null) {
    const schedule = jest.fn().mockResolvedValue({
      sequenceNumber: { toString: () => '9001' },
    });
    const publish = jest.fn();
    const create = jest.fn().mockResolvedValue(buildRow(notificationAudioUrl));
    const updateAzureMessageId = jest.fn().mockImplementation(async () =>
      buildRow(notificationAudioUrl),
    );

    const repository = {
      findUserDeviceToken: jest.fn().mockResolvedValue('device-token'),
      create,
      updateAzureMessageId,
      markFailed: jest.fn(),
    };
    const messaging = {
      publisher: { publish },
      scheduler: { schedule },
    };

    const service = new ScheduledNotificationService(
      repository as unknown as ScheduledNotificationRepository,
      messaging as unknown as MessagingInfrastructure,
    );

    return { service, create, schedule, publish };
  }

  it('stores the voice audio URL and keeps the dispatch contract unchanged', async () => {
    const { service, create, schedule, publish } = buildService(audioUrl);

    const result = await service.createInternal({
      userId: 7n,
      title: 'Medicine',
      message: 'Take your tablet',
      scheduledAt,
      childReminderId: 9n,
      notificationType: 'ReminderOnTime',
      notificationAudioUrl: audioUrl,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationAudioUrl: audioUrl,
        notificationType: 'ReminderOnTime',
        childReminderId: 9n,
        status: 'SCHEDULED',
      }),
    );
    expect(publish).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: 'notifications',
        eventType: NotificationEventTypes.DISPATCH,
        payload: expect.objectContaining({
          eventType: NotificationEventTypes.SCHEDULED,
          userId: '7',
          sourceEntityId: '42',
          data: {
            scheduledNotificationId: '42',
            status: 'SCHEDULED',
            notificationType: 'ReminderOnTime',
            childReminderId: '9',
          },
        }),
      }),
    );
    expect(result.notificationAudioUrl).toBe(audioUrl);
    expect(result.id).toBe('42');
  });

  it('leaves the audio URL empty when the caller does not supply one', async () => {
    const { service, create, schedule } = buildService(null);

    const result = await service.createInternal({
      userId: 7n,
      title: 'Medicine',
      message: 'Take your tablet',
      scheduledAt,
      childReminderId: 9n,
      notificationType: 'ReminderOnTime',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationAudioUrl: null,
      }),
    );
    const scheduledPayload = schedule.mock.calls[0]?.[0] as {
      payload: { data: Record<string, string> };
    };
    expect(scheduledPayload.payload.data).not.toHaveProperty('notificationAudioUrl');
    expect(result.notificationAudioUrl).toBeNull();
  });
});
