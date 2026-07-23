import {
  ServiceBusClient,
  type ServiceBusReceiver,
  type ServiceBusSender,
} from '@azure/service-bus';
import { messagingConfig, isMessagingEnabled } from '../config/messaging.config';
import { MessagingConfigurationError, MessagingConnectionError } from '../errors/messaging.errors';
import { logger } from '../../../logger/src/logger';

type ProcessorSubscription = {
  close: () => Promise<void>;
};

/**
 * Manages Azure Service Bus client lifecycle, senders, receivers, and processors.
 */
export class AzureServiceBusManager {
  #client: ServiceBusClient | null = null;
  readonly #senders = new Map<string, ServiceBusSender>();
  readonly #receivers = new Map<string, ServiceBusReceiver>();
  readonly #processors = new Map<string, ProcessorSubscription>();
  #initialized = false;

  /**
   * Initializes the Service Bus client (idempotent).
   */
  async initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }

    if (!isMessagingEnabled()) {
      logger.warn({ service: 'messaging' }, 'messaging disabled — client not initialized');
      return;
    }

    const connectionString = messagingConfig.SERVICE_BUS_CONNECTION_STRING;

    if (!connectionString) {
      throw new MessagingConfigurationError(
        'AZURE_SERVICE_BUS_CONNECTION_STRING is required when messaging is enabled',
      );
    }

    try {
      this.#client = new ServiceBusClient(connectionString);
      this.#initialized = true;
      logger.info({ service: 'messaging' }, 'Azure Service Bus client initialized');
    } catch (error) {
      throw new MessagingConnectionError(
        error instanceof Error ? error.message : 'Failed to initialize Service Bus client',
      );
    }
  }

  isInitialized(): boolean {
    return this.#initialized && this.#client !== null;
  }

  getClient(): ServiceBusClient {
    this.#ensureClient();
    return this.#client as ServiceBusClient;
  }

  /**
   * Returns a cached sender for the queue (creates on first use).
   */
  getSender(queueName: string): ServiceBusSender {
    this.#ensureClient();

    const cacheKey = `queue:${queueName}`;
    let sender = this.#senders.get(cacheKey);

    if (!sender) {
      sender = (this.#client as ServiceBusClient).createSender(queueName);
      this.#senders.set(cacheKey, sender);
    }

    return sender;
  }

  /**
   * Returns a cached receiver for the queue.
   */
  getReceiver(queueName: string, options?: { subQueue?: 'deadLetter' }): ServiceBusReceiver {
    this.#ensureClient();

    const cacheKey = options?.subQueue
      ? `queue:${queueName}:dlq`
      : `queue:${queueName}:main`;

    let receiver = this.#receivers.get(cacheKey);

    if (!receiver) {
      const receiverOptions: {
        receiveMode: typeof messagingConfig.DEFAULT_RECEIVE_MODE;
        subQueueType?: 'deadLetter';
      } = {
        receiveMode: messagingConfig.DEFAULT_RECEIVE_MODE,
      };

      if (options?.subQueue) {
        receiverOptions.subQueueType = options.subQueue;
      }

      receiver = (this.#client as ServiceBusClient).createReceiver(queueName, receiverOptions);
      this.#receivers.set(cacheKey, receiver);
    }

    return receiver;
  }

  /**
   * Registers a processor subscription for graceful shutdown tracking.
   */
  registerProcessor(queueName: string, subscription: ProcessorSubscription): void {
    this.#processors.set(queueName, subscription);
  }

  unregisterProcessor(queueName: string): void {
    this.#processors.delete(queueName);
  }

  getActiveProcessorCount(): number {
    return this.#processors.size;
  }

  /**
   * Closes all resources and the client.
   */
  async shutdown(): Promise<void> {
    const closeTasks: Promise<void>[] = [];

    for (const [name, processor] of this.#processors) {
      closeTasks.push(
        processor.close().catch((error) => {
          logger.error({ err: error, queueName: name, service: 'messaging' }, 'processor close failed');
        }),
      );
    }

    await Promise.all(closeTasks);
    this.#processors.clear();

    for (const receiver of this.#receivers.values()) {
      await receiver.close().catch(() => undefined);
    }
    this.#receivers.clear();

    for (const sender of this.#senders.values()) {
      await sender.close().catch(() => undefined);
    }
    this.#senders.clear();

    if (this.#client) {
      await this.#client.close();
      this.#client = null;
    }

    this.#initialized = false;
    logger.info({ service: 'messaging' }, 'Azure Service Bus client shut down');
  }

  #ensureClient(): void {
    if (!this.#client) {
      throw new MessagingConfigurationError(
        'Service Bus client is not initialized. Call initialize() first or enable messaging.',
      );
    }
  }
}
