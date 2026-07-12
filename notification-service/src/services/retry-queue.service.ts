import { ServiceBusClient, ServiceBusSender } from '@azure/service-bus';
import { RetryMessage } from '../types/notification.types';
import { logger } from '../utils/logger';

export class RetryQueueService {
  private client: ServiceBusClient | null = null;
  private sender: ServiceBusSender | null = null;

  constructor(
    private readonly connectionString: string,
    private readonly retryQueueName: string
  ) {}

  async enqueueRetry(message: RetryMessage): Promise<void> {
    if (!this.connectionString) {
      logger.warn('SERVICE_BUS_CONNECTION_STRING not configured; skipping retry enqueue', {
        originalMessageId: message.originalMessageId,
        retryCount: message.retryCount,
      });
      return;
    }

    const client = this.getClient();
    const sender = this.getSender();

    try {
      await sender.sendMessages({
        body: message,
        messageId: `${message.originalMessageId}-retry-${message.retryCount}`,
        contentType: 'application/json',
        applicationProperties: {
          retryCount: message.retryCount,
          originalMessageId: message.originalMessageId,
        },
      });

      logger.info('Retry message enqueued', {
        originalMessageId: message.originalMessageId,
        retryCount: message.retryCount,
        failedDeviceCount: message.failedDevices.length,
      });
    } catch (error) {
      logger.error('Failed to enqueue retry message', {
        originalMessageId: message.originalMessageId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private getClient(): ServiceBusClient {
    if (!this.client) {
      this.client = new ServiceBusClient(this.connectionString);
    }
    return this.client;
  }

  private getSender(): ServiceBusSender {
    if (!this.sender) {
      this.sender = this.getClient().createSender(this.retryQueueName);
    }
    return this.sender;
  }

  async close(): Promise<void> {
    await this.sender?.close();
    await this.client?.close();
    this.sender = null;
    this.client = null;
  }
}
