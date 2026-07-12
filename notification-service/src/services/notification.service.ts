import { NotificationRepository } from '../repositories/notification.repository';
import {
  DeviceSendResult,
  FailedDeviceRef,
  NOTIFICATION_LOG_STATUS,
  RetryMessage,
  ServiceBusNotificationMessage,
} from '../types/notification.types';
import { ValidatedRetryMessage } from '../types/validation.schemas';
import { parseChildReminderId } from '../utils/fcm.utils';
import { createChildLogger, logger } from '../utils/logger';
import { DeviceService } from './device.service';
import { FcmService } from './fcm.service';
import { RetryQueueService } from './retry-queue.service';

export interface ProcessResult {
  action: 'processed' | 'skipped_duplicate' | 'skipped_completed' | 'skipped_no_devices';
  notificationLogId?: number;
  successCount?: number;
  failedCount?: number;
}

export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly deviceService: DeviceService,
    private readonly fcmService: FcmService,
    private readonly retryQueueService: RetryQueueService,
    private readonly maxRetryCount: number
  ) {}

  async processDispatchMessage(message: ServiceBusNotificationMessage): Promise<ProcessResult> {
    const log = createChildLogger({
      messageId: message.messageId,
      userId: message.payload.userId,
      eventType: message.payload.eventType,
    });

    const existing = await this.notificationRepository.findByMessageId(message.messageId);
    if (existing) {
      log.info('Duplicate message ignored', { notificationLogId: Number(existing.Id) });
      return { action: 'skipped_duplicate', notificationLogId: Number(existing.Id) };
    }

    const childReminderId = parseChildReminderId(message.payload.data);
    if (childReminderId !== null) {
      const isCompleted =
        await this.notificationRepository.isReminderNotificationCompleted(childReminderId);
      if (isCompleted) {
        log.info('Reminder notification already completed; skipping', { childReminderId });
        await this.notificationRepository.createNotificationLog(message, NOTIFICATION_LOG_STATUS.SKIPPED);
        return { action: 'skipped_completed' };
      }
    }

    const notificationLog = await this.notificationRepository.createNotificationLog(message);

    const devices = await this.deviceService.getActiveDevicesForUser(message.payload.userId);
    if (devices.length === 0) {
      log.warn('No active devices found for user');
      await this.notificationRepository.updateNotificationLogStatus(
        Number(notificationLog.Id),
        NOTIFICATION_LOG_STATUS.FAILED,
        'No active devices found'
      );
      return { action: 'skipped_no_devices', notificationLogId: Number(notificationLog.Id) };
    }

    await this.notificationRepository.createDeliveryRecords(
      Number(notificationLog.Id),
      devices.map((d) => d.id)
    );

    const results = await this.fcmService.sendToDevices(devices, {
      title: message.payload.title,
      body: message.payload.body,
      data: message.payload.data,
    });

    return this.handleSendResults({
      notificationLogId: Number(notificationLog.Id),
      originalMessageId: message.messageId,
      retryCount: message.retryCount ?? 0,
      results,
      payload: message.payload,
      childReminderId,
      isRetry: false,
    });
  }

  async processRetryMessage(retryMessage: ValidatedRetryMessage): Promise<ProcessResult> {
    const log = createChildLogger({
      originalMessageId: retryMessage.originalMessageId,
      retryCount: retryMessage.retryCount,
    });

    const originalLog = await this.notificationRepository.findByMessageId(
      retryMessage.originalMessageId
    );

    if (!originalLog) {
      log.error('Original notification log not found for retry');
      throw new Error(
        `Original notification log not found: ${retryMessage.originalMessageId}`
      );
    }

    const deviceIds = retryMessage.failedDevices.map((d) =>
      parseInt(d.userDeviceTokenId, 10)
    );

    const devices = await this.deviceService.getActiveDevicesByIds(deviceIds);

    if (devices.length === 0) {
      log.warn('No active devices remaining for retry');
      return {
        action: 'skipped_no_devices',
        notificationLogId: Number(originalLog.Id),
      };
    }

    const results = await this.fcmService.sendToDevices(devices, {
      title: retryMessage.payload.title,
      body: retryMessage.payload.body,
      data: retryMessage.payload.data,
    });

    const childReminderId = parseChildReminderId(retryMessage.payload.data);

    return this.handleSendResults({
      notificationLogId: Number(originalLog.Id),
      originalMessageId: retryMessage.originalMessageId,
      retryCount: retryMessage.retryCount,
      results,
      payload: {
        module: retryMessage.payload.module ?? 'reminder',
        eventType: retryMessage.payload.eventType ?? '',
        userId: retryMessage.payload.userId ?? String(originalLog.UserId),
        title: retryMessage.payload.title,
        body: retryMessage.payload.body,
        channels: ['push'],
        data: retryMessage.payload.data,
      },
      childReminderId,
      isRetry: true,
    });
  }

  private async handleSendResults(params: {
    notificationLogId: number;
    originalMessageId: string;
    retryCount: number;
    results: DeviceSendResult[];
    payload: ServiceBusNotificationMessage['payload'];
    childReminderId: number | null;
    isRetry: boolean;
  }): Promise<ProcessResult> {
    const {
      notificationLogId,
      originalMessageId,
      retryCount,
      results,
      payload,
      childReminderId,
      isRetry,
    } = params;

    const log = createChildLogger({
      notificationLogId,
      originalMessageId,
      isRetry,
    });

    let successCount = 0;
    let failedCount = 0;
    const retryableFailures: FailedDeviceRef[] = [];

    for (const result of results) {
      if (result.success) {
        successCount++;
        await this.notificationRepository.updateDeliveryStatus(
          notificationLogId,
          result.userDeviceTokenId,
          'SENT',
          undefined,
          isRetry
        );
        continue;
      }

      failedCount++;

      if (result.isPermanentFailure) {
        await this.notificationRepository.updateDeliveryStatus(
          notificationLogId,
          result.userDeviceTokenId,
          'INVALID_TOKEN',
          result.errorMessage,
          isRetry
        );
        await this.deviceService.deactivateInvalidToken(result.userDeviceTokenId);
        continue;
      }

      await this.notificationRepository.updateDeliveryStatus(
        notificationLogId,
        result.userDeviceTokenId,
        'FAILED',
        result.errorMessage,
        isRetry
      );

      retryableFailures.push({
        userDeviceTokenId: String(result.userDeviceTokenId),
        fcmToken: result.fcmToken,
      });
    }

    const hasAnySuccess = successCount > 0;

    if (hasAnySuccess && childReminderId !== null) {
      await this.notificationRepository.markReminderPhaseCompleted(childReminderId, payload);
      log.info('Reminder marked as completed after successful delivery', { childReminderId });
    }

    const finalStatus = this.resolveNotificationLogStatus(successCount, failedCount);
    await this.notificationRepository.updateNotificationLogStatus(notificationLogId, finalStatus);

    if (retryableFailures.length > 0 && retryCount < this.maxRetryCount) {
      await this.enqueueDeviceRetries({
        originalMessageId,
        retryCount: retryCount + 1,
        failedDevices: retryableFailures,
        payload,
      });
    } else if (retryableFailures.length > 0) {
      logger.warn('Max retry count reached; giving up on failed devices', {
        originalMessageId,
        retryCount,
        failedDeviceCount: retryableFailures.length,
      });
    }

    log.info('Notification processing completed', {
      successCount,
      failedCount,
      finalStatus,
      retryEnqueued: retryableFailures.length > 0 && retryCount < this.maxRetryCount,
    });

    return {
      action: 'processed',
      notificationLogId,
      successCount,
      failedCount,
    };
  }

  private resolveNotificationLogStatus(successCount: number, failedCount: number): string {
    if (successCount > 0 && failedCount === 0) {
      return NOTIFICATION_LOG_STATUS.DELIVERED;
    }
    if (successCount > 0 && failedCount > 0) {
      return NOTIFICATION_LOG_STATUS.PARTIAL;
    }
    return NOTIFICATION_LOG_STATUS.FAILED;
  }

  private async enqueueDeviceRetries(params: {
    originalMessageId: string;
    retryCount: number;
    failedDevices: FailedDeviceRef[];
    payload: ServiceBusNotificationMessage['payload'];
  }): Promise<void> {
    const retryMessage: RetryMessage = {
      originalMessageId: params.originalMessageId,
      retryCount: params.retryCount,
      failedDevices: params.failedDevices,
      payload: {
        title: params.payload.title,
        body: params.payload.body,
        data: Object.fromEntries(
          Object.entries(params.payload.data ?? {}).map(([k, v]) => [k, String(v ?? '')])
        ),
        userId: params.payload.userId,
        eventType: params.payload.eventType,
        module: params.payload.module,
      },
    };

    await this.retryQueueService.enqueueRetry(retryMessage);
  }
}
