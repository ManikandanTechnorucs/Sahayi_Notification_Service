import {
  type ProcessErrorArgs,
  type ServiceBusReceiver,
  type ServiceBusReceivedMessage,
} from '@azure/service-bus';
import type { AzureServiceBusManager } from './azure-service-bus.manager';
import { messagingConfig } from '../config/messaging.config';
import type { MessageHandler, MessageHandlerContext } from '../types/message-handler';
import type { QueueWorkerConfig } from '../types/worker-registration';
import { parseMessageEnvelope } from '../utils/validate-envelope';
import { messagingMetrics } from '../observability/messaging-metrics';
import { logger } from '../../../logger/src/logger';

type ActiveConsumer = {
  queueName: string;
  close: () => Promise<void>;
};

/**
 * Generic consumer framework — subscribes to queues and invokes injected handlers.
 */
export class GenericConsumerFramework {
  readonly #manager: AzureServiceBusManager;
  readonly #activeConsumers: ActiveConsumer[] = [];
  #isShuttingDown = false;

  constructor(manager: AzureServiceBusManager) {
    this.#manager = manager;
  }

  /**
   * Starts a processor for a registered worker configuration.
   */
  async startWorker(config: QueueWorkerConfig): Promise<void> {
    const client = this.#manager.getClient();
    const maxConcurrentCalls =
      config.maxConcurrentCalls ??
      config.concurrency ??
      messagingConfig.DEFAULT_WORKER_CONCURRENCY;

    const maxAutoLockRenewalDurationInMs =
      config.maxAutoLockRenewalDurationInMs ??
      messagingConfig.DEFAULT_MAX_AUTO_LOCK_RENEWAL_MS;

    const processor = client.createReceiver(config.queueName, {
      receiveMode: config.receiveMode ?? messagingConfig.DEFAULT_RECEIVE_MODE,
      maxAutoLockRenewalDurationInMs,
    });

    const subscription = processor.subscribe(
      {
        processMessage: async (message) => {
          if (this.#isShuttingDown) {
            await processor.abandonMessage(message);
            return;
          }

          await this.#processMessage(config, message, processor);
        },
        processError: async (args) => {
          await this.#handleProcessError(config, args);
        },
      },
      {
        maxConcurrentCalls,
        autoCompleteMessages: false,
      },
    );

    this.#manager.registerProcessor(config.queueName, subscription);
    this.#activeConsumers.push({
      queueName: config.queueName,
      close: () => subscription.close(),
    });

    logger.info(
      {
        service: 'messaging',
        queueName: config.queueName,
        handler: config.handler.name,
        maxConcurrentCalls,
        maxAutoLockRenewalDurationInMs,
      },
      'consumer worker started',
    );
  }

  /**
   * Stops all active consumers gracefully.
   */
  async shutdown(): Promise<void> {
    this.#isShuttingDown = true;

    await Promise.all(
      this.#activeConsumers.map(async (consumer) => {
        try {
          await consumer.close();
          this.#manager.unregisterProcessor(consumer.queueName);
        } catch (error) {
          logger.error(
            { err: error, queueName: consumer.queueName, service: 'messaging' },
            'consumer shutdown failed',
          );
        }
      }),
    );

    this.#activeConsumers.length = 0;
    logger.info({ service: 'messaging' }, 'all consumers shut down');
  }

  async #processMessage(
    config: QueueWorkerConfig,
    message: ServiceBusReceivedMessage,
    receiver: ServiceBusReceiver,
  ): Promise<void> {
    const startedAt = new Date();
    const queueName = config.queueName;

    let envelope;

    try {
      envelope = parseMessageEnvelope(message.body);
    } catch (error) {
      messagingMetrics.incrementFailed(queueName);
      await receiver.deadLetterMessage(message, {
        deadLetterReason: 'InvalidEnvelope',
        deadLetterErrorDescription:
          error instanceof Error ? error.message : 'Envelope validation failed',
      });
      return;
    }

    if (!this.#handlerAcceptsEvent(config.handler, envelope.eventType)) {
      logger.warn(
        {
          service: 'messaging',
          queueName,
          handler: config.handler.name,
          eventType: envelope.eventType,
        },
        'no handler for event type — completing message',
      );
      await receiver.completeMessage(message);
      return;
    }

    const context: MessageHandlerContext = {
      queueName,
      receivedMessage: message,
      envelope,
      deliveryCount: message.deliveryCount ?? 1,
      correlationId: envelope.correlationId,
      startedAt,
    };

    try {
      const result = await config.handler.handle(context);
      const settlement = this.#resolveSettlement(result);

      if (settlement.deadLetter) {
        await receiver.deadLetterMessage(message, {
          deadLetterReason: settlement.deadLetterReason ?? 'HandlerDeadLetter',
          deadLetterErrorDescription:
            settlement.deadLetterErrorDescription ?? 'Message dead-lettered by handler',
        });
        messagingMetrics.incrementDeadLettered(queueName);
        return;
      }

      if (settlement.abandon) {
        await receiver.abandonMessage(message);
        messagingMetrics.incrementFailed(queueName);
        return;
      }

      await receiver.completeMessage(message);
      messagingMetrics.incrementConsumed(queueName);
      messagingMetrics.recordDuration(queueName, Date.now() - startedAt.getTime());

      logger.info(
        {
          service: 'messaging',
          queueName,
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          eventType: envelope.eventType,
          durationMs: Date.now() - startedAt.getTime(),
          handler: config.handler.name,
        },
        'message processed',
      );
    } catch (error) {
      messagingMetrics.incrementFailed(queueName);
      const err = error instanceof Error ? error : new Error(String(error));

      if (config.handler.onError) {
        await config.handler.onError(err, context).catch(() => undefined);
      }

      const deliveryCount = message.deliveryCount ?? 1;
      const maxDelivery =
        config.maxDeliveryCount ?? messagingConfig.DEFAULT_MAX_DELIVERY_COUNT;

      if (deliveryCount >= maxDelivery) {
        await receiver.deadLetterMessage(message, {
          deadLetterReason: 'MaxDeliveryCountExceeded',
          deadLetterErrorDescription: err.message,
        });
        messagingMetrics.incrementDeadLettered(queueName);
      } else {
        await receiver.abandonMessage(message);
      }

      logger.error(
        {
          err,
          service: 'messaging',
          queueName,
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          deliveryCount,
        },
        'message processing failed',
      );
    }
  }

  async #handleProcessError(config: QueueWorkerConfig, args: ProcessErrorArgs): Promise<void> {
    const err = args.error as Error & { code?: string; name?: string };

    if (this.#isShuttingDown && err.name === 'AbortError') {
      return;
    }

    if (err.code === 'MessagingEntityNotFound' || err.name === 'ServiceBusError') {
      const isEntityNotFound =
        err.code === 'MessagingEntityNotFound' ||
        err.message.includes('could not be found');

      if (isEntityNotFound) {
        logger.error(
          {
            service: 'messaging',
            queueName: config.queueName,
            namespace: args.fullyQualifiedNamespace,
            hint: `Create queue "${config.queueName}" in Azure Portal or set MESSAGING_ENSURE_QUEUE=true (dev) with Manage permission on the SAS key`,
          },
          'service bus queue not found',
        );
        return;
      }
    }

    logger.error(
      {
        err: args.error,
        service: 'messaging',
        queueName: config.queueName,
        errorSource: args.errorSource,
        entityPath: args.entityPath,
        fullyQualifiedNamespace: args.fullyQualifiedNamespace,
      },
      'service bus process error',
    );

    if (config.handler.onError) {
      const stubContext = {
        queueName: config.queueName,
        receivedMessage: {} as ServiceBusReceivedMessage,
        envelope: {
          messageId: 'unknown',
          correlationId: 'unknown',
          eventType: 'unknown',
          queueName: config.queueName,
          payload: null,
          createdAt: new Date().toISOString(),
          sourceSystem: messagingConfig.SOURCE_SYSTEM,
          retryCount: 0,
        },
        deliveryCount: 0,
        correlationId: 'unknown',
        startedAt: new Date(),
      };

      await config.handler
        .onError(args.error, stubContext, args)
        .catch(() => undefined);
    }

    messagingMetrics.incrementFailed(config.queueName);
  }

  #handlerAcceptsEvent(handler: MessageHandler, eventType: string): boolean {
    if (!handler.supportedEventTypes || handler.supportedEventTypes.length === 0) {
      return true;
    }

    return handler.supportedEventTypes.includes(eventType);
  }

  #resolveSettlement(result: Awaited<ReturnType<MessageHandler['handle']>>): {
    complete: boolean;
    abandon: boolean;
    deadLetter: boolean;
    deadLetterReason?: string;
    deadLetterErrorDescription?: string;
  } {
    if (!result) {
      return { complete: true, abandon: false, deadLetter: false };
    }

    if (result.deadLetter) {
      const settlement: {
        complete: boolean;
        abandon: boolean;
        deadLetter: boolean;
        deadLetterReason?: string;
        deadLetterErrorDescription?: string;
      } = {
        complete: false,
        abandon: false,
        deadLetter: true,
      };

      if (result.deadLetterReason !== undefined) {
        settlement.deadLetterReason = result.deadLetterReason;
      }

      if (result.deadLetterErrorDescription !== undefined) {
        settlement.deadLetterErrorDescription = result.deadLetterErrorDescription;
      }

      return settlement;
    }

    if (result.abandon) {
      return { complete: false, abandon: true, deadLetter: false };
    }

    return {
      complete: result.complete !== false,
      abandon: false,
      deadLetter: false,
    };
  }
}
