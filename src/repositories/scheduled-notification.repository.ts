import { prisma } from '../../libs/db/src/prisma';
import type {
  DeliveredNotification,
  ScheduledNotification,
  ScheduledNotificationStatus,
} from '../../generated/prisma/client';
import { REMINDER_NOTIFICATION_TYPE_VALUES, ACTIVE_SCHEDULE_STATUSES } from '../constants/reminder-notification.constants';

export type CreateScheduledNotificationRecord = {
  userId: bigint;
  title: string;
  message: string;
  scheduledAt: Date;
  status: ScheduledNotificationStatus;
  deviceToken?: string | null;
  childReminderId?: bigint | null;
  notificationType?: string | null;
};

export type DeliveredNotificationWithSchedule = DeliveredNotification & {
  scheduledNotification: ScheduledNotification | null;
};

export type PaginatedDeliveredNotifications = {
  items: DeliveredNotificationWithSchedule[];
  total: number;
};

const ACTIVE_STATUSES: ScheduledNotificationStatus[] = [
  ...ACTIVE_SCHEDULE_STATUSES,
];

/**
 * Data-access for ScheduledNotification rows.
 */
export class ScheduledNotificationRepository {
  /**
   * Fetches delivered notifications for a user with pagination and related schedule.
   * Ordered by DeliveredAt DESC (latest first).
   */
  async findDeliveredByUserId(
    userId: bigint,
    page: number,
    limit: number,
  ): Promise<PaginatedDeliveredNotifications> {
    const where = { UserId: userId };
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.deliveredNotification.count({ where }),
      prisma.deliveredNotification.findMany({
        where,
        include: {
          scheduledNotification: true,
        },
        orderBy: { DeliveredAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { items, total };
  }

  /**
   * Loads a scheduled notification by primary key.
   */
  async findById(id: bigint): Promise<ScheduledNotification | null> {
    return prisma.scheduledNotification.findUnique({
      where: { Id: id },
    });
  }

  /**
   * Loads active schedules for a single child reminder.
   */
  async findActiveByChildReminderId(childReminderId: bigint): Promise<ScheduledNotification[]> {
    return prisma.scheduledNotification.findMany({
      where: {
        ChildReminderId: childReminderId,
        Status: { in: ACTIVE_STATUSES },
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  /**
   * Loads active schedules for multiple child reminders.
   */
  async findActiveByChildReminderIds(childReminderIds: bigint[]): Promise<ScheduledNotification[]> {
    if (childReminderIds.length === 0) {
      return [];
    }

    return prisma.scheduledNotification.findMany({
      where: {
        ChildReminderId: { in: childReminderIds },
        Status: { in: ACTIVE_STATUSES },
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  /**
   * Loads active reminder schedules tied to today's children or scheduled for today.
   */
  async findActiveReminderSchedulesForDate(
    dateStart: Date,
    dateEnd: Date,
    childReminderIds: bigint[],
  ): Promise<ScheduledNotification[]> {
    const childFilter =
      childReminderIds.length > 0
        ? [{ ChildReminderId: { in: childReminderIds } }]
        : [];

    return prisma.scheduledNotification.findMany({
      where: {
        Status: { in: ACTIVE_STATUSES },
        OR: [
          ...childFilter,
          {
            ScheduledAt: {
              gte: dateStart,
              lte: dateEnd,
            },
            NotificationType: {
              in: [...REMINDER_NOTIFICATION_TYPE_VALUES],
            },
          },
        ],
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  /**
   * Inserts a scheduled notification with initial SCHEDULED status.
   */
  async create(data: CreateScheduledNotificationRecord): Promise<ScheduledNotification> {
    return prisma.scheduledNotification.create({
      data: {
        UserId: data.userId,
        ChildReminderId: data.childReminderId ?? null,
        NotificationType: data.notificationType ?? null,
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
   * Marks a scheduled notification as CANCELLED.
   */
  async cancelById(id: bigint): Promise<ScheduledNotification> {
    return prisma.scheduledNotification.update({
      where: { Id: id },
      data: {
        Status: 'CANCELLED',
        UpdatedAt: new Date(),
      },
    });
  }

  /**
   * Marks all active schedules for a child reminder as CANCELLED.
   */
  async cancelByChildReminderId(childReminderId: bigint): Promise<number> {
    const result = await prisma.scheduledNotification.updateMany({
      where: {
        ChildReminderId: childReminderId,
        Status: { in: ACTIVE_STATUSES },
      },
      data: {
        Status: 'CANCELLED',
        UpdatedAt: new Date(),
      },
    });

    return result.count;
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

  /**
   * Marks the given delivered notifications as read for a user.
   * Only unread rows owned by the user are updated.
   */
  async markDeliveredAsRead(
    userId: bigint,
    ids: bigint[],
    readAt: Date,
  ): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await prisma.deliveredNotification.updateMany({
      where: {
        UserId: userId,
        Id: { in: ids },
        IsRead: false,
      },
      data: {
        IsRead: true,
        ReadAt: readAt,
      },
    });

    return result.count;
  }

  /**
   * Counts unread delivered notifications for a user.
   */
  async countUnreadDeliveredByUserId(userId: bigint): Promise<number> {
    return prisma.deliveredNotification.count({
      where: {
        UserId: userId,
        IsRead: false,
      },
    });
  }
}
