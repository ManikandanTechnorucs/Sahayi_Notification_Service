jest.mock('../../../libs/db/src/prisma', () => ({
  prisma: {
    userdevicetoken: { findFirst: jest.fn() },
    users: { findUnique: jest.fn() },
  },
}));

jest.mock('../../../libs/logger/src/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { prisma } from '../../../libs/db/src/prisma';
import { ScheduledNotificationRepository } from '../scheduled-notification.repository';

const db = prisma as unknown as {
  userdevicetoken: { findFirst: jest.Mock };
  users: { findUnique: jest.Mock };
};

describe('ScheduledNotificationRepository.findUserDeviceToken', () => {
  const repository = new ScheduledNotificationRepository();

  it('snapshots the APNs token for an active iOS device', async () => {
    db.userdevicetoken.findFirst.mockResolvedValue({
      FcmToken: 'ios-fcm-token',
      APNstoken: 'apns-token',
      Platform: 'ios',
    });

    await expect(repository.findUserDeviceToken(3n)).resolves.toBe('apns-token');
    expect(db.users.findUnique).not.toHaveBeenCalled();
  });

  it('snapshots the FCM token for an active Android device', async () => {
    db.userdevicetoken.findFirst.mockResolvedValue({
      FcmToken: 'android-token',
      APNstoken: null,
      Platform: 'android',
    });

    await expect(repository.findUserDeviceToken(3n)).resolves.toBe('android-token');
  });

  it('snapshots the FCM token when an iOS device has no APNs token', async () => {
    db.userdevicetoken.findFirst.mockResolvedValue({
      FcmToken: 'ios-fcm-token',
      APNstoken: null,
      Platform: 'IOS',
    });

    await expect(repository.findUserDeviceToken(3n)).resolves.toBe('ios-fcm-token');
  });

  it('falls back to the profile FCM token when no device row is active', async () => {
    db.userdevicetoken.findFirst.mockResolvedValue(null);
    db.users.findUnique.mockResolvedValue({ FcmToken: 'profile-token' });

    await expect(repository.findUserDeviceToken(3n)).resolves.toBe('profile-token');
  });
});
