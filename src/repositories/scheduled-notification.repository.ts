import { prisma } from '../../libs/db/src/prisma';
import { logger } from '../../libs/logger/src/logger';
import { selectDeliveryTarget } from '../utils/delivery-target';
import { formatNotificationFailure } from '../utils/notification-failure';
import type {
  DeliveredNotification,
  Prisma,
  ScheduledNotification,
  ScheduledNotificationStatus as ScheduledNotificationStatusType,
} from '../../generated/prisma/client';
import {
  REMINDER_NOTIFICATION_TYPE_VALUES,
  ACTIVE_SCHEDULE_STATUSES,
} from '../constants/reminder-notification.constants';
import { ScheduledNotificationStatus } from '../constants/scheduled-notification.constants';

export type CreateScheduledNotificationRecord = {
  userId: bigint;
  title: string;
  message: string;
  scheduledAt: Date;
  status: ScheduledNotificationStatusType;
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

const ACTIVE_STATUSES: ScheduledNotificationStatusType[] = [
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
  async cancelById(id: bigint, stage: string, reason: string): Promise<ScheduledNotification> {
    const errorMessage = formatNotificationFailure(stage, reason);
    const existing = await prisma.scheduledNotification.findUnique({ where: { Id: id } });
    const cancelled = await prisma.scheduledNotification.update({
      where: { Id: id },
      data: {
        Status: ScheduledNotificationStatus.CANCELLED,
        ErrorMessage: errorMessage,
        UpdatedAt: new Date(),
      },
    });

    if (existing) {
      await recordNotificationStage(existing, stage, ScheduledNotificationStatus.CANCELLED, errorMessage);
    }

    return cancelled;
  }

  /**
   * Marks all active schedules for a child reminder as CANCELLED.
   */
  async cancelByChildReminderId(
    childReminderId: bigint,
    stage: string,
    reason: string,
  ): Promise<number> {
    return cancelActiveRows(
      {
        ChildReminderId: childReminderId,
        Status: { in: ACTIVE_STATUSES },
      },
      stage,
      reason,
    );
  }

  /**
   * Loads active schedules for a user.
   */
  async findActiveByUserId(userId: bigint): Promise<ScheduledNotification[]> {
    return prisma.scheduledNotification.findMany({
      where: {
        UserId: userId,
        Status: { in: ACTIVE_STATUSES },
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  /**
   * Marks all active schedules for a user as CANCELLED.
   */
  async cancelByUserId(userId: bigint, stage: string, reason: string): Promise<number> {
    return cancelActiveRows(
      {
        UserId: userId,
        Status: { in: ACTIVE_STATUSES },
      },
      stage,
      reason,
    );
  }

  /**
   * Marks a scheduled notification as FAILED after a queue publish error.
   */
  async markFailed(
    id: bigint,
    reason: string,
    stage = 'queue-publish',
  ): Promise<ScheduledNotification> {
    const errorMessage = formatNotificationFailure(stage, reason);
    const existing = await prisma.scheduledNotification.findUnique({ where: { Id: id } });
    const failed = await prisma.scheduledNotification.update({
      where: { Id: id },
      data: {
        Status: ScheduledNotificationStatus.FAILED,
        FailedAt: new Date(),
        ErrorMessage: errorMessage,
        UpdatedAt: new Date(),
      },
    });

    if (existing) {
      await recordNotificationStage(existing, stage, ScheduledNotificationStatus.FAILED, errorMessage);
    }

    return failed;
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
   * Loads the token for the user's active device.
   * iOS snapshots the APNs token. Android snapshots the FCM token.
   * users.FcmToken is the fallback and stays an FCM credential.
   */
  async findUserDeviceToken(userId: bigint): Promise<string | null> {
    const device = await prisma.userdevicetoken.findFirst({
      where: { UserId: userId, IsActive: true },
      orderBy: [{ LastUsedAt: 'desc' }, { Id: 'desc' }],
      select: { FcmToken: true, APNstoken: true, Platform: true },
    });

    if (device) {
      const target = selectDeliveryTarget(device.Platform, device.FcmToken, device.APNstoken);
      if (target) {
        if (target.channel === 'fcm' && device.Platform.trim().toLowerCase() === 'ios') {
          logger.warn(
            { userId: userId.toString() },
            'iOS device has no APNs token; schedule snapshot will use the FCM token',
          );
        }
        return target.token;
      }
    }

    const user = await prisma.users.findUnique({
      where: { Id: userId },
      select: { FcmToken: true },
    });

    const profileToken = user?.FcmToken?.trim();
    return profileToken ? profileToken : null;
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

async function cancelActiveRows(
  where: Prisma.ScheduledNotificationWhereInput,
  stage: string,
  reason: string,
): Promise<number> {
  const errorMessage = formatNotificationFailure(stage, reason);
  const rows = await prisma.scheduledNotification.findMany({ where });

  if (rows.length === 0) {
    return 0;
  }

  await prisma.scheduledNotification.updateMany({
    where: { Id: { in: rows.map((row) => row.Id) } },
    data: {
      Status: ScheduledNotificationStatus.CANCELLED,
      ErrorMessage: errorMessage,
      UpdatedAt: new Date(),
    },
  });

  await Promise.all(
    rows.map((row) =>
      recordNotificationStage(row, stage, ScheduledNotificationStatus.CANCELLED, errorMessage),
    ),
  );

  return rows.length;
}

async function recordNotificationStage(
  row: { Id: bigint; UserId: bigint; Title: string; Message: string },
  stage: string,
  status: string,
  errorMessage: string,
): Promise<void> {
  try {
    const messageId = `${row.Id.toString(36)}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`.slice(0, 64);
    await prisma.notificationlog.create({
      data: {
        MessageId: messageId,
        CorrelationId: row.Id.toString().slice(0, 64),
        UserId: row.UserId,
        Module: 'notification',
        EventType: `notification.${stage}`.slice(0, 100),
        SourceEntityId: row.Id.toString().slice(0, 64),
        Title: row.Title.slice(0, 200),
        Body: row.Message.slice(0, 1000),
        Channels: ['push'],
        Status: status.slice(0, 20),
        LastError: errorMessage.slice(0, 500),
        PayloadSnapshot: {
          stage,
          scheduledNotificationId: row.Id.toString(),
          errorMessage,
        },
        CompletedAt: new Date(),
      },
    });
  } catch (error) {
    logger.warn(
      { err: error, scheduledNotificationId: row.Id.toString(), stage },
      'failed to write notification stage log',
    );
  }
}
