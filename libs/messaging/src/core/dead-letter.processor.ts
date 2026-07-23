import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import type { AzureServiceBusManager } from './azure-service-bus.manager';
import type { GenericMessagePublisher } from './generic-message.publisher';
import { messagingConfig } from '../config/messaging.config';
import type { MessageHandler } from '../types/message-handler';
import { parseMessageEnvelope } from '../utils/validate-envelope';
import { messagingMetrics } from '../observability/messaging-metrics';
import { logger } from '../../../logger/src/logger';

export type DeadLetterProcessResult = {
  queueName: string;
  processed: number;
  reprocessed: number;
  discarded: number;
  failures: number;
};

export type DeadLetterProcessorOptions = {
  queueName: string;
  handler?: MessageHandler;
  maxMessages?: number;
  reprocessToMainQueue?: boolean;
};

/**
 * Reads and optionally reprocesses messages from a queue's dead-letter sub-queue.
 */
export class DeadLetterProcessor {
  readonly #manager: AzureServiceBusManager;
  readonly #publisher: GenericMessagePublisher;

  constructor(manager: AzureServiceBusManager, publisher: GenericMessagePublisher) {
    this.#manager = manager;
    this.#publisher = publisher;
  }

  /**
   * Processes a batch of dead-letter messages for diagnostics and optional reprocessing.
   */
  async processDeadLetters(
    options: DeadLetterProcessorOptions,
  ): Promise<DeadLetterProcessResult> {
    const maxMessages = options.maxMessages ?? messagingConfig.DLQ_MAX_MESSAGES_PER_RUN;
    const reprocess =
      options.reprocessToMainQueue ?? messagingConfig.DLQ_REPROCESS_ENABLED;

    const receiver = this.#manager.getReceiver(options.queueName, { subQueue: 'deadLetter' });

    const messages = await receiver.receiveMessages(maxMessages, {
      maxWaitTimeInMs: 5000,
    });

    const result: DeadLetterProcessResult = {
      queueName: options.queueName,
      processed: 0,
      reprocessed: 0,
      discarded: 0,
      failures: 0,
    };

    for (const message of messages) {
      result.processed += 1;

      try {
        const handled = await this.#handleDeadLetterMessage(
          options.queueName,
          message,
          options.handler,
          reprocess,
        );

        if (handled === 'reprocessed') {
          result.reprocessed += 1;
          await receiver.completeMessage(message);
        } else if (handled === 'discarded') {
          result.discarded += 1;
          await receiver.completeMessage(message);
        } else {
          await receiver.completeMessage(message);
        }
      } catch (error) {
        result.failures += 1;
        logger.error(
          {
            err: error,
            service: 'messaging',
            queueName: options.queueName,
            messageId: message.messageId,
          },
          'dead letter message processing failed',
        );
      }
    }

    logger.info(
      {
        service: 'messaging',
        ...result,
      },
      'dead letter batch processed',
    );

    return result;
  }

  async #handleDeadLetterMessage(
    queueName: string,
    message: ServiceBusReceivedMessage,
    handler: MessageHandler | undefined,
    reprocess: boolean,
  ): Promise<'reprocessed' | 'discarded' | 'logged'> {
    let envelope;

    try {
      envelope = parseMessageEnvelope(message.body);
    } catch {
      logger.warn(
        {
          service: 'messaging',
          queueName,
          messageId: message.messageId,
          deadLetterReason: message.deadLetterReason,
          deadLetterErrorDescription: message.deadLetterErrorDescription,
        },
        'dead letter message has invalid envelope',
      );
      return 'discarded';
    }

    logger.warn(
      {
        service: 'messaging',
        queueName,
        messageId: envelope.messageId,
        correlationId: envelope.correlationId,
        eventType: envelope.eventType,
        retryCount: envelope.retryCount,
        deadLetterReason: message.deadLetterReason,
        deadLetterErrorDescription: message.deadLetterErrorDescription,
        deliveryCount: message.deliveryCount,
      },
      'dead letter message recorded',
    );

    messagingMetrics.incrementDeadLettered(queueName);

    if (handler) {
      const context = {
        queueName,
        receivedMessage: message,
        envelope,
        deliveryCount: message.deliveryCount ?? 0,
        correlationId: envelope.correlationId,
        startedAt: new Date(),
      };

      const handlerResult = await handler.handle(context);

      if (handlerResult?.deadLetter) {
        return 'discarded';
      }
    }

    if (reprocess) {
      const publishInput: Parameters<GenericMessagePublisher['publish']>[0] = {
        queueName,
        eventType: envelope.eventType,
        payload: envelope.payload,
      };

      if (envelope.metadata !== undefined) {
        publishInput.options = {
          correlationId: envelope.correlationId,
          metadata: envelope.metadata,
        };
      } else {
        publishInput.options = {
          correlationId: envelope.correlationId,
        };
      }

      await this.#publisher.publish(publishInput);

      return 'reprocessed';
    }

    return 'logged';
  }
}
