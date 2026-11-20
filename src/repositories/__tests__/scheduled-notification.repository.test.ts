jest.mock('../../../libs/db/src/prisma', () => ({
  prisma: {
    scheduledNotification: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notificationlog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../../libs/logger/src/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { prisma } from '../../../libs/db/src/prisma';
import { ScheduledNotificationRepository } from '../scheduled-notification.repository';

const db = prisma as unknown as {
  scheduledNotification: {
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  notificationlog: { create: jest.Mock };
};

describe('ScheduledNotificationRepository cancellation reasons', () => {
  const repository = new ScheduledNotificationRepository();

  it('stores the stage and reason on a cancelled row and writes a log', async () => {
    const existing = {
      Id: 21n,
      UserId: 4n,
      Title: 'Medicine',
      Message: 'Take your tablet',
    };
    db.scheduledNotification.findUnique.mockResolvedValue(existing);
    db.scheduledNotification.update.mockImplementation(async ({ data }) => ({
      ...existing,
      ...data,
    }));
    db.notificationlog.create.mockResolvedValue({});

    const cancelled = await repository.cancelById(
      21n,
      'schedule-sync',
      'fire time drifted by 90000 ms',
    );

    expect(cancelled.ErrorMessage).toBe('[schedule-sync] fire time drifted by 90000 ms');
    expect(db.notificationlog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          EventType: 'notification.schedule-sync',
          Status: 'CANCELLED',
          LastError: '[schedule-sync] fire time drifted by 90000 ms',
        }),
      }),
    );
  });

  it('stores a queue-publish reason when scheduling fails', async () => {
    db.scheduledNotification.findUnique.mockResolvedValue({
      Id: 22n,
      UserId: 4n,
      Title: 'Welcome',
      Message: 'Hello',
    });
    db.scheduledNotification.update.mockImplementation(async ({ data }) => data);
    db.notificationlog.create.mockResolvedValue({});

    const failed = await repository.markFailed(22n, 'Service Bus timeout');

    expect(failed.ErrorMessage).toBe('[queue-publish] Service Bus timeout');
    expect(failed.Status).toBe('FAILED');
  });
});
