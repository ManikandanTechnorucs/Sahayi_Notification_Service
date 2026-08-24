import Long from 'long';
import { ScheduledNotificationStatus } from '../../generated/prisma/client';
import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';
import {
  NotificationEventTypes,
  type NotificationDispatchPayload,
} from '../../libs/notification-contracts/src/index';
import type { MessagingInfrastructure } from '../../libs/messaging/src/index';
import { NotFoundError, ValidationError } from '../errors/app-error';
import type { ScheduledNotificationRepository } from '../repositories/scheduled-notification.repository';
import type {
  BulkMarkDeliveredReadResultDto,
  DeliveredNotificationListResult,
  DeliveredNotificationResponseDto,
  ScheduledNotificationResponseDto,
  UnreadDeliveredCountDto,
} from '../dto/scheduled-notification.dto';
import type {
  BulkMarkDeliveredReadBody,
  CreateScheduledNotificationBody,
  GetDeliveredNotificationsQuery,
} from '../validators/scheduled-notification.validator';
import { IMMEDIATE_NOTIFICATION_THRESHOLD_MS } from '../constants/app-notification.constants';
import { resolveScheduledEnqueueTime } from '../utils/reminder-schedule-time.util';

export type InternalCreateScheduledNotificationInput = {
  userId: bigint;
  title: string;
  message: string;
  scheduledAt: Date;
  childReminderId?: bigint;
  notificationType?: string;
  clientEventId?: string;
  screen?: string;
};

/**
 * Business logic for scheduling push notifications via Azure Service Bus.
 */
export class ScheduledNotificationService {
  readonly #repository: ScheduledNotificationRepository;
  readonly #messaging: MessagingInfrastructure;

  constructor(
    repository: ScheduledNotificationRepository,
    messaging: MessagingInfrastructure,
  ) {
    this.#repository = repository;
    this.#messaging = messaging;
  }

  /**
   * Fetches delivered notifications for the authenticated user with pagination.
   * Sorted by DeliveredAt DESC and includes related scheduled notification details.
   */
  async getDelivered(
    userId: string,
    query: GetDeliveredNotificationsQuery,
  ): Promise<DeliveredNotificationListResult> {
    let parsedUserId: bigint;

    try {
      parsedUserId = BigInt(userId);
    } catch {
      throw new ValidationError('Authenticated user id is invalid');
    }

    const page = query.page ?? config.DELIVERED_NOTIFICATION_DEFAULT_PAGE;
    const limit = Math.min(
      query.limit ?? config.DELIVERED_NOTIFICATION_DEFAULT_LIMIT,
      config.DELIVERED_NOTIFICATION_MAX_LIMIT,
    );

    const { items, total } = await this.#repository.findDeliveredByUserId(
      parsedUserId,
      page,
      limit,
    );

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items: items.map((notification) => this.#toDeliveredResponseDto(notification)),
      page,
      limit,
      total,
      totalPages,
    };
  }

  /**
   * Bulk-marks delivered notifications as read for the authenticated user.
   */
  async bulkMarkDeliveredAsRead(
    userId: string,
    input: BulkMarkDeliveredReadBody,
  ): Promise<BulkMarkDeliveredReadResultDto> {
    let parsedUserId: bigint;

    try {
      parsedUserId = BigInt(userId);
    } catch {
      throw new ValidationError('Authenticated user id is invalid');
    }

    const ids = [...new Set(input.ids.map((id) => BigInt(id)))];
    const readAt = new Date();
    const updatedCount = await this.#repository.markDeliveredAsRead(
      parsedUserId,
      ids,
      readAt,
    );

    logger.info(
      {
        userId: parsedUserId.toString(),
        requestedCount: ids.length,
        updatedCount,
      },
      'delivered notifications marked as read',
    );

    return {
      updatedCount,
      readAt: readAt.toISOString(),
    };
  }

  /**
   * Returns unread delivered notification count for the authenticated user.
   */
  async getUnreadDeliveredCount(userId: string): Promise<UnreadDeliveredCountDto> {
    let parsedUserId: bigint;

    try {
      parsedUserId = BigInt(userId);
    } catch {
      throw new ValidationError('Authenticated user id is invalid');
    }

    const unreadCount = await this.#repository.countUnreadDeliveredByUserId(parsedUserId);

    return { unreadCount };
  }

  #toDeliveredResponseDto(notification: {
    Id: bigint;
    ScheduledNotificationId: bigint;
    UserId: bigint;
    Title: string;
    Message: string;
    NotificationAudioUrl: string | null;
    DeliveredAt: Date;
    ReadAt: Date | null;
    IsRead: boolean;
    CreatedAt: Date;
    scheduledNotification: {
      Id: bigint;
      UserId: bigint;
      ChildReminderId: bigint | null;
      NotificationType: string | null;
      Title: string;
      Message: string;
      Status: string;
      ScheduledAt: Date;
      SentAt: Date | null;
      DeliveredAt: Date | null;
      FailedAt: Date | null;
      RetryCount: number;
      ErrorMessage: string | null;
      CreatedAt: Date;
      UpdatedAt: Date | null;
    } | null;
  }): DeliveredNotificationResponseDto {
    const schedule = notification.scheduledNotification;

    return {
      id: notification.Id.toString(),
      scheduledNotificationId: notification.ScheduledNotificationId.toString(),
      userId: notification.UserId.toString(),
      title: notification.Title,
      message: notification.Message,
      notificationAudioUrl: notification.NotificationAudioUrl ?? null,
      deliveredAt: notification.DeliveredAt.toISOString(),
      readAt: notification.ReadAt?.toISOString() ?? null,
      isRead: notification.IsRead,
      createdAt: notification.CreatedAt.toISOString(),
      scheduledNotification: schedule
        ? {
            id: schedule.Id.toString(),
            userId: schedule.UserId.toString(),
            childReminderId: schedule.ChildReminderId?.toString() ?? null,
            notificationType: schedule.NotificationType,
            title: schedule.Title,
            message: schedule.Message,
            status: schedule.Status,
            scheduledAt: schedule.ScheduledAt.toISOString(),
            sentAt: schedule.SentAt?.toISOString() ?? null,
            deliveredAt: schedule.DeliveredAt?.toISOString() ?? null,
            failedAt: schedule.FailedAt?.toISOString() ?? null,
            retryCount: schedule.RetryCount,
            errorMessage: schedule.ErrorMessage,
            createdAt: schedule.CreatedAt.toISOString(),
            updatedAt: schedule.UpdatedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * Creates a SCHEDULED row and enqueues on Azure Service Bus.
   * Near-term scheduledAt values are published immediately; future times use scheduleMessages.
   */
  async create(input: CreateScheduledNotificationBody): Promise<ScheduledNotificationResponseDto> {
    const userId = BigInt(input.userId);

    if (!config.NOTIFICATION_QUEUE_NAME) {
      throw new ValidationError('NOTIFICATION_QUEUE_NAME is not configured');
    }

    const userExists = await this.#repository.userExists(userId);

    if (!userExists) {
      throw new NotFoundError('User');
    }

    const childReminderId =
      input.childReminderId !== undefined ? BigInt(input.childReminderId) : undefined;

    const row = await this.createInternal({
      userId,
      title: input.title,
      message: input.message,
      scheduledAt: input.scheduledAt,
      ...(childReminderId !== undefined ? { childReminderId } : {}),
      ...(input.notificationType !== undefined ? { notificationType: input.notificationType } : {}),
      ...(input.clientEventId !== undefined ? { clientEventId: input.clientEventId } : {}),
      ...(input.screen !== undefined ? { screen: input.screen } : {}),
    });

    return row;
  }

  /**
   * Internal schedule path for sync jobs — skips HTTP-level user validation.
   */
  async createInternal(
    input: InternalCreateScheduledNotificationInput,
  ): Promise<ScheduledNotificationResponseDto> {
    const queueName = config.NOTIFICATION_QUEUE_NAME;

    if (!queueName) {
      throw new ValidationError('NOTIFICATION_QUEUE_NAME is not configured');
    }

    const deliverImmediately = this.#shouldDeliverImmediately(input.scheduledAt);
    const enqueueAt = deliverImmediately
      ? new Date()
      : resolveScheduledEnqueueTime(input.scheduledAt);
    const deviceToken = await this.#repository.findUserDeviceToken(input.userId);

    // Persist desired fire time (not enqueueAt) so sync drift checks stay accurate
    // after immediate publishes that use "now" as the Azure enqueue time.
    const created = await this.#repository.create({
      userId: input.userId,
      title: input.title,
      message: input.message,
      scheduledAt: input.scheduledAt,
      status: ScheduledNotificationStatus.SCHEDULED,
      deviceToken,
      childReminderId: input.childReminderId ?? null,
      notificationType: input.notificationType ?? null,
    });

    const payload: NotificationDispatchPayload = {
      module: 'notification',
      eventType: NotificationEventTypes.SCHEDULED,
      userId: input.userId.toString(),
      title: input.title,
      body: input.message,
      channels: config.NOTIFICATION_DEFAULT_CHANNELS,
      sourceEntityId: created.Id.toString(),
      data: {
        scheduledNotificationId: created.Id.toString(),
        status: ScheduledNotificationStatus.SCHEDULED,
        ...(input.notificationType ? { notificationType: input.notificationType } : {}),
        ...(input.childReminderId !== undefined
          ? { childReminderId: input.childReminderId.toString() }
          : {}),
        ...(input.clientEventId ? { clientEventId: input.clientEventId } : {}),
        ...(input.screen ? { screen: input.screen } : {}),
      },
      metadata: {
        scheduledFor: enqueueAt.toISOString(),
        ...(input.clientEventId ? { clientEventId: input.clientEventId } : {}),
        ...(input.screen ? { screen: input.screen } : {}),
      },
    };

    const queueOptions = {
      correlationId: created.Id.toString(),
      metadata: {
        scheduledNotificationId: created.Id.toString(),
        ...(input.notificationType ? { notificationType: input.notificationType } : {}),
        ...(input.childReminderId !== undefined
          ? { childReminderId: input.childReminderId.toString() }
          : {}),
        ...(input.clientEventId ? { clientEventId: input.clientEventId } : {}),
        ...(input.screen ? { screen: input.screen } : {}),
      },
      subject: NotificationEventTypes.SCHEDULED,
    };

    let azureMessageId: string;

    try {
      if (deliverImmediately) {
        const envelope = await this.#messaging.publisher.publish({
          queueName,
          eventType: NotificationEventTypes.DISPATCH,
          payload,
          options: queueOptions,
        });

        azureMessageId = envelope.messageId;
      } else {
        const scheduled = await this.#messaging.scheduler.schedule({
          queueName,
          eventType: NotificationEventTypes.DISPATCH,
          payload,
          scheduledEnqueueTime: enqueueAt,
          options: queueOptions,
        });

        azureMessageId = scheduled.sequenceNumber.toString();
      }
    } catch (error) {
      await this.#repository.markFailed(
        created.Id,
        error instanceof Error
          ? error.message
          : deliverImmediately
            ? 'Failed to publish Azure Service Bus message'
            : 'Failed to schedule Azure Service Bus message',
      );

      throw error;
    }

    const updated = await this.#repository.updateAzureMessageId(created.Id, azureMessageId);

    logger.info(
      {
        scheduledNotificationId: created.Id.toString(),
        userId: input.userId.toString(),
        childReminderId: input.childReminderId?.toString(),
        notificationType: input.notificationType,
        azureMessageId,
        scheduledAt: input.scheduledAt.toISOString(),
        enqueueAt: enqueueAt.toISOString(),
        deliverImmediately,
        queueName,
      },
      deliverImmediately
        ? 'notification created and published immediately'
        : 'scheduled notification created and queued',
    );

    return this.#toResponseDto(updated);
  }

  /**
   * Cancels a single scheduled notification and its Azure sequence when present.
   */
  async cancel(id: string): Promise<ScheduledNotificationResponseDto> {
    let parsedId: bigint;

    try {
      parsedId = BigInt(id);
    } catch {
      throw new ValidationError('Scheduled notification id is invalid');
    }

    const existing = await this.#repository.findById(parsedId);

    if (!existing) {
      throw new NotFoundError('Scheduled notification');
    }

    if (
      existing.Status === ScheduledNotificationStatus.CANCELLED ||
      existing.Status === ScheduledNotificationStatus.DELIVERED ||
      existing.Status === ScheduledNotificationStatus.SENT
    ) {
      return this.#toResponseDto(existing);
    }

    await this.#cancelAzureSchedule(existing.AzureMessageId);

    const cancelled = await this.#repository.cancelById(parsedId);

    logger.info(
      {
        scheduledNotificationId: parsedId.toString(),
        childReminderId: existing.ChildReminderId?.toString(),
        notificationType: existing.NotificationType,
      },
      'scheduled notification cancelled',
    );

    return this.#toResponseDto(cancelled);
  }

  /**
   * Cancels all active schedules for a child reminder.
   */
  async cancelByChildReminder(childReminderId: string): Promise<{ cancelledCount: number }> {
    let parsedChildReminderId: bigint;

    try {
      parsedChildReminderId = BigInt(childReminderId);
    } catch {
      throw new ValidationError('Child reminder id is invalid');
    }

    const activeSchedules =
      await this.#repository.findActiveByChildReminderId(parsedChildReminderId);

    for (const schedule of activeSchedules) {
      await this.#cancelAzureSchedule(schedule.AzureMessageId);
    }

    const cancelledCount = await this.#repository.cancelByChildReminderId(parsedChildReminderId);

    logger.info(
      {
        childReminderId: parsedChildReminderId.toString(),
        cancelledCount,
      },
      'child reminder schedules cancelled',
    );

    return { cancelledCount };
  }

  #shouldDeliverImmediately(scheduledAt: Date): boolean {
    return scheduledAt.getTime() <= Date.now() + IMMEDIATE_NOTIFICATION_THRESHOLD_MS;
  }

  async #cancelAzureSchedule(azureMessageId: string | null): Promise<void> {
    const queueName = config.NOTIFICATION_QUEUE_NAME;

    // Immediate publishes store messageId (UUID), not a schedule sequence number.
    if (!queueName || !azureMessageId || !/^-?\d+$/.test(azureMessageId)) {
      return;
    }

    try {
      await this.#messaging.scheduler.cancelScheduled(
        queueName,
        Long.fromString(azureMessageId),
      );
    } catch (error) {
      logger.warn(
        {
          err: error,
          azureMessageId,
          queueName,
        },
        'failed to cancel Azure scheduled message; marking row cancelled anyway',
      );
    }
  }

  #toResponseDto(row: {
    Id: bigint;
    UserId: bigint;
    ChildReminderId: bigint | null;
    NotificationType: string | null;
    DeviceToken: string | null;
    Title: string;
    Message: string;
    Status: string;
    AzureMessageId: string | null;
    ScheduledAt: Date;
    SentAt: Date | null;
    DeliveredAt: Date | null;
    FailedAt: Date | null;
    RetryCount: number;
    ErrorMessage: string | null;
    CreatedAt: Date;
    UpdatedAt: Date | null;
  }): ScheduledNotificationResponseDto {
    return {
      id: row.Id.toString(),
      userId: row.UserId.toString(),
      childReminderId: row.ChildReminderId?.toString() ?? null,
      notificationType: row.NotificationType,
      deviceToken: row.DeviceToken,
      title: row.Title,
      message: row.Message,
      status: row.Status,
      azureMessageId: row.AzureMessageId,
      scheduledAt: row.ScheduledAt.toISOString(),
      sentAt: row.SentAt?.toISOString() ?? null,
      deliveredAt: row.DeliveredAt?.toISOString() ?? null,
      failedAt: row.FailedAt?.toISOString() ?? null,
      retryCount: row.RetryCount,
      errorMessage: row.ErrorMessage,
      createdAt: row.CreatedAt.toISOString(),
      updatedAt: row.UpdatedAt?.toISOString() ?? null,
    };
  }
}
