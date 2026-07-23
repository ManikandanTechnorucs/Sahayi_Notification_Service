import { prisma } from '../../libs/db/src/prisma';
import type {
  DeliveredNotification,
  ScheduledNotification,
  ScheduledNotificationStatus,
} from '../../generated/prisma/client';

export type CreateScheduledNotificationRecord = {
  userId: bigint;
  title: string;
  message: string;
  scheduledAt: Date;
  status: ScheduledNotificationStatus;
  deviceToken?: string | null;
};

/**
 * Data-access for ScheduledNotification rows.
 */
export class ScheduledNotificationRepository {
  /**
   * Fetches delivered notifications belonging to the authenticated user.
   */
  async findDeliveredByUserId(userId: bigint): Promise<DeliveredNotification[]> {
    return prisma.deliveredNotification.findMany({
      where: { UserId: userId },
      orderBy: { DeliveredAt: 'desc' },
    });
  }

  /**
   * Inserts a scheduled notification with initial SCHEDULED status.
   */
  async create(data: CreateScheduledNotificationRecord): Promise<ScheduledNotification> {
    return prisma.scheduledNotification.create({
      data: {
        UserId: data.userId,
        Title: data.title,
        Message: data.message,
        ScheduledAt: data.scheduledAt,
        Status: data.status,
        DeviceToken: data.deviceToken ?? null,
        UpdatedAt: new Date(),
      },
    });
  }

  /**
   * Persists the Azure Service Bus scheduled message id/sequence number.
   */
  async updateAzureMessageId(id: bigint, azureMessageId: string): Promise<ScheduledNotification> {
    return prisma.scheduledNotification.update({
      where: { Id: id },
      data: {
        AzureMessageId: azureMessageId,
        UpdatedAt: new Date(),
      },
    });
  }

  /**
   * Marks a scheduled notification as FAILED after a queue publish error.
   */
  async markFailed(id: bigint, errorMessage: string): Promise<ScheduledNotification> {
    return prisma.scheduledNotification.update({
      where: { Id: id },
      data: {
        Status: 'FAILED',
        FailedAt: new Date(),
        ErrorMessage: errorMessage.slice(0, 1000),
        UpdatedAt: new Date(),
      },
    });
  }

  /**
   * Returns true when the user exists.
   */
  async userExists(userId: bigint): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { Id: userId },
      select: { Id: true },
    });

    return Boolean(user);
  }

  /**
   * Loads the user's primary FCM token when available.
   */
  async findUserDeviceToken(userId: bigint): Promise<string | null> {
    const user = await prisma.users.findUnique({
      where: { Id: userId },
      select: { FcmToken: true },
    });

    if (user?.FcmToken) {
      return user.FcmToken;
    }

    const device = await prisma.userdevicetoken.findFirst({
      where: { UserId: userId, IsActive: true },
      orderBy: { LastUsedAt: 'desc' },
      select: { FcmToken: true },
    });

    return device?.FcmToken ?? null;
  }
}
