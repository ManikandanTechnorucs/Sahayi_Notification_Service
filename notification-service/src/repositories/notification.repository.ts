import { Prisma, PrismaClient } from '@prisma/client';
import { NotificationPayload, ServiceBusNotificationMessage } from '../types/notification.types';

export type DeviceDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'INVALID_TOKEN';

interface DeviceChannelResult {
  userDeviceTokenId: string;
  status: DeviceDeliveryStatus;
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
}

interface ChannelResultsPayload {
  push: {
    devices: DeviceChannelResult[];
  };
}

function emptyChannelResults(): ChannelResultsPayload {
  return { push: { devices: [] } };
}

function parseChannelResults(value: Prisma.JsonValue | null): ChannelResultsPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return emptyChannelResults();
  }

  const parsed = value as unknown as ChannelResultsPayload;
  const push = parsed.push;
  if (!push || !Array.isArray(push.devices)) {
    return emptyChannelResults();
  }

  return { push: { devices: push.devices } };
}

export class NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByMessageId(messageId: string) {
    return this.prisma.notificationlog.findUnique({
      where: { MessageId: messageId },
    });
  }

  async createNotificationLog(
    message: ServiceBusNotificationMessage,
    status = 'PROCESSING'
  ) {
    const { payload } = message;

    return this.prisma.notificationlog.create({
      data: {
        MessageId: message.messageId,
        CorrelationId: message.correlationId ?? message.messageId,
        EventType: payload.eventType,
        UserId: BigInt(payload.userId),
        Module: payload.module,
        Title: payload.title,
        Body: payload.body,
        SourceEntityId: payload.sourceEntityId,
        Channels: payload.channels,
        Status: status,
        PayloadSnapshot: {
          data: payload.data ?? {},
          metadata: payload.metadata ?? {},
          dispatchEventType: message.eventType,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async updateNotificationLogStatus(
    notificationLogId: number,
    status: string,
    lastError?: string
  ): Promise<void> {
    await this.prisma.notificationlog.update({
      where: { Id: BigInt(notificationLogId) },
      data: {
        Status: status,
        LastError: lastError,
        CompletedAt: ['DELIVERED', 'PARTIAL', 'FAILED', 'SKIPPED'].includes(status)
          ? new Date()
          : undefined,
        UpdatedAt: new Date(),
      },
    });
  }

  async createDeliveryRecords(
    notificationLogId: number,
    deviceTokenIds: number[]
  ): Promise<void> {
    if (deviceTokenIds.length === 0) {
      return;
    }

    const channelResults: ChannelResultsPayload = {
      push: {
        devices: deviceTokenIds.map((deviceTokenId) => ({
          userDeviceTokenId: String(deviceTokenId),
          status: 'PENDING',
          retryCount: 0,
        })),
      },
    };

    await this.prisma.notificationlog.update({
      where: { Id: BigInt(notificationLogId) },
      data: {
        ChannelResults: channelResults as unknown as Prisma.InputJsonValue,
        UpdatedAt: new Date(),
      },
    });
  }

  async updateDeliveryStatus(
    notificationLogId: number,
    userDeviceTokenId: number,
    status: DeviceDeliveryStatus,
    errorMessage?: string,
    incrementRetry = false
  ): Promise<void> {
    const log = await this.prisma.notificationlog.findUnique({
      where: { Id: BigInt(notificationLogId) },
      select: { ChannelResults: true },
    });

    const channelResults = parseChannelResults(log?.ChannelResults ?? null);
    const deviceId = String(userDeviceTokenId);
    const existingIndex = channelResults.push.devices.findIndex(
      (device) => device.userDeviceTokenId === deviceId
    );

    const nextDevice: DeviceChannelResult = {
      userDeviceTokenId: deviceId,
      status,
      retryCount:
        existingIndex >= 0
          ? channelResults.push.devices[existingIndex].retryCount + (incrementRetry ? 1 : 0)
          : incrementRetry
            ? 1
            : 0,
      lastAttemptAt: new Date().toISOString(),
      errorMessage,
    };

    if (existingIndex >= 0) {
      channelResults.push.devices[existingIndex] = nextDevice;
    } else {
      channelResults.push.devices.push(nextDevice);
    }

    await this.prisma.notificationlog.update({
      where: { Id: BigInt(notificationLogId) },
      data: {
        ChannelResults: channelResults as unknown as Prisma.InputJsonValue,
        UpdatedAt: new Date(),
      },
    });
  }

  async getChildReminder(childReminderId: number) {
    return this.prisma.childreminder.findUnique({
      where: { Id: BigInt(childReminderId) },
    });
  }

  async isReminderNotificationCompleted(childReminderId: number): Promise<boolean> {
    const reminder = await this.getChildReminder(childReminderId);
    if (!reminder) {
      return false;
    }

    return (
      reminder.BeforeNotificationSent ||
      reminder.OnTimeNotificationSent ||
      reminder.AfterNotificationSent ||
      reminder.CompletedAt !== null
    );
  }

  async markReminderPhaseCompleted(
    childReminderId: number,
    payload: NotificationPayload
  ): Promise<void> {
    const phaseField = this.getPhaseUpdateField(payload.eventType);
    if (!phaseField) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.childreminder.update({
        where: { Id: BigInt(childReminderId) },
        data: {
          [phaseField]: true,
          CompletedAt: new Date(),
          UpdatedAt: new Date(),
        },
      }),
      this.prisma.childremindernotificationschedule.updateMany({
        where: {
          ChildReminderId: BigInt(childReminderId),
          IsCancelled: false,
        },
        data: { IsCancelled: true },
      }),
    ]);
  }

  private getPhaseUpdateField(
    eventType: string
  ): 'BeforeNotificationSent' | 'OnTimeNotificationSent' | 'AfterNotificationSent' | null {
    switch (eventType) {
      case 'reminder.before':
        return 'BeforeNotificationSent';
      case 'reminder.on-time':
        return 'OnTimeNotificationSent';
      case 'reminder.after':
        return 'AfterNotificationSent';
      default:
        return null;
    }
  }
}
