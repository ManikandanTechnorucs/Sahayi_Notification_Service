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
import type { CreateScheduledNotificationBody } from '../validators/scheduled-notification.validator';
import type {
  DeliveredNotificationResponseDto,
  ScheduledNotificationResponseDto,
} from '../dto/scheduled-notification.dto';

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
   * Fetches delivered notifications for the authenticated user.
   */
  async getDelivered(userId: string): Promise<DeliveredNotificationResponseDto[]> {
    let parsedUserId: bigint;

    try {
      parsedUserId = BigInt(userId);
    } catch {
      throw new ValidationError('Authenticated user id is invalid');
    }

    const notifications = await this.#repository.findDeliveredByUserId(parsedUserId);

    return notifications.map((notification) => ({
      id: notification.Id.toString(),
      scheduledNotificationId: notification.ScheduledNotificationId.toString(),
      userId: notification.UserId.toString(),
      title: notification.Title,
      message: notification.Message,
      deliveredAt: notification.DeliveredAt.toISOString(),
      readAt: notification.ReadAt?.toISOString() ?? null,
      isRead: notification.IsRead,
      createdAt: notification.CreatedAt.toISOString(),
    }));
  }

  /**
   * Creates a SCHEDULED row, enqueues a scheduled Azure Service Bus message,
   * then stores the Azure sequence number on AzureMessageId.
   */
  async create(input: CreateScheduledNotificationBody): Promise<ScheduledNotificationResponseDto> {
    const userId = BigInt(input.userId);
    const queueName = config.NOTIFICATION_QUEUE_NAME;

    if (!queueName) {
      throw new ValidationError('NOTIFICATION_QUEUE_NAME is not configured');
    }

    const userExists = await this.#repository.userExists(userId);

    if (!userExists) {
      throw new NotFoundError('User');
    }

    const deviceToken = await this.#repository.findUserDeviceToken(userId);

    const created = await this.#repository.create({
      userId,
      title: input.title,
      message: input.message,
      scheduledAt: input.scheduledAt,
      status: ScheduledNotificationStatus.SCHEDULED,
      deviceToken,
    });

    const payload: NotificationDispatchPayload = {
      module: 'notification',
      eventType: NotificationEventTypes.SCHEDULED,
      userId: userId.toString(),
      title: input.title,
      body: input.message,
      channels: config.NOTIFICATION_DEFAULT_CHANNELS,
      sourceEntityId: created.Id.toString(),
      data: {
        scheduledNotificationId: created.Id.toString(),
        status: ScheduledNotificationStatus.SCHEDULED,
      },
      metadata: {
        scheduledFor: input.scheduledAt.toISOString(),
      },
    };

    let azureMessageId: string;

    try {
      const scheduled = await this.#messaging.scheduler.schedule({
        queueName,
        eventType: NotificationEventTypes.DISPATCH,
        payload,
        scheduledEnqueueTime: input.scheduledAt,
        options: {
          correlationId: created.Id.toString(),
          metadata: {
            scheduledNotificationId: created.Id.toString(),
          },
          subject: NotificationEventTypes.SCHEDULED,
        },
      });

      azureMessageId = scheduled.sequenceNumber.toString();
    } catch (error) {
      await this.#repository.markFailed(
        created.Id,
        error instanceof Error ? error.message : 'Failed to schedule Azure Service Bus message',
      );

      throw error;
    }

    const updated = await this.#repository.updateAzureMessageId(created.Id, azureMessageId);

    logger.info(
      {
        scheduledNotificationId: created.Id.toString(),
        userId: userId.toString(),
        azureMessageId,
        scheduledAt: input.scheduledAt.toISOString(),
        queueName,
      },
      'scheduled notification created and queued',
    );

    return this.#toResponseDto(updated);
  }

  #toResponseDto(row: {
    Id: bigint;
    UserId: bigint;
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
