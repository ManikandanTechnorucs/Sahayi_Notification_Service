import type { ServiceBusMessage } from '@azure/service-bus';
import type { AzureServiceBusManager } from './azure-service-bus.manager';
import { messagingConfig } from '../config/messaging.config';
import { MessagingPublishError } from '../errors/messaging.errors';
import type {
  BatchPublishItem,
  MessageEnvelope,
  PublishOptions,
} from '../types/message-envelope';
import { buildEnvelope, type EnvelopeBuildParams } from '../utils/envelope-builder.util';
import { maskSensitiveData } from '../utils/mask-secrets';
import { messagingMetrics } from '../observability/messaging-metrics';
import { logger } from '../../../logger/src/logger';

export type PublishInput<TPayload = unknown> = {
  queueName: string;
  eventType: string;
  payload: TPayload;
  options?: PublishOptions;
};

/**
 * Publishes generic messages to any Azure Service Bus queue.
 */
export class GenericMessagePublisher {
  readonly #manager: AzureServiceBusManager;

  constructor(manager: AzureServiceBusManager) {
    this.#manager = manager;
  }

  /**
   * Publishes a single message to the specified queue.
   */
  async publish<TPayload>(input: PublishInput<TPayload>): Promise<MessageEnvelope<TPayload>> {
    const envelope = this.#buildEnvelopeFromInput(input);

    const serviceBusMessage = this.#toServiceBusMessage(envelope, input.options);

    try {
      const sender = this.#manager.getSender(input.queueName);
      await sender.sendMessages(serviceBusMessage);

      messagingMetrics.incrementPublished(input.queueName);

      logger.info(
        {
          service: 'messaging',
          queueName: input.queueName,
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          eventType: envelope.eventType,
          ...(messagingConfig.LOG_PAYLOAD
            ? { payload: maskSensitiveData({ payload: envelope.payload } as Record<string, unknown>) }
            : {}),
        },
        'message published',
      );

      return envelope;
    } catch (error) {
      logger.error(
        {
          err: error,
          service: 'messaging',
          queueName: input.queueName,
          eventType: input.eventType,
        },
        'message publish failed',
      );

      throw new MessagingPublishError(
        error instanceof Error ? error.message : 'Failed to publish message',
      );
    }
  }

  /**
   * Publishes multiple messages in a single batch to the same queue.
   */
  async publishBatch<TPayload>(
    queueName: string,
    items: BatchPublishItem<TPayload>[],
  ): Promise<MessageEnvelope<TPayload>[]> {
    if (items.length === 0) {
      return [];
    }

    const envelopes = items.map((item) => {
      const params: EnvelopeBuildParams<TPayload> = {
        eventType: item.envelope.eventType,
        queueName,
        payload: item.envelope.payload,
        sourceSystem: item.envelope.sourceSystem ?? messagingConfig.SOURCE_SYSTEM,
      };

      const correlationId = item.options?.correlationId ?? item.envelope.correlationId;
      const metadata = item.options?.metadata ?? item.envelope.metadata;

      if (correlationId !== undefined) {
        params.correlationId = correlationId;
      }

      if (metadata !== undefined) {
        params.metadata = metadata;
      }

      if (item.envelope.scheduledAt) {
        params.scheduledAt = new Date(item.envelope.scheduledAt);
      }

      if (item.envelope.retryCount !== undefined) {
        params.retryCount = item.envelope.retryCount;
      }

      return buildEnvelope(params);
    });

    const messages = envelopes.map((envelope, index) =>
      this.#toServiceBusMessage(envelope, items[index]?.options),
    );

    try {
      const sender = this.#manager.getSender(queueName);
      await sender.sendMessages(messages);

      for (const _envelope of envelopes) {
        messagingMetrics.incrementPublished(queueName);
      }

      logger.info(
        {
          service: 'messaging',
          queueName,
          batchSize: envelopes.length,
        },
        'message batch published',
      );

      return envelopes;
    } catch (error) {
      throw new MessagingPublishError(
        error instanceof Error ? error.message : 'Failed to publish message batch',
      );
    }
  }

  #toServiceBusMessage(
    envelope: MessageEnvelope,
    options?: PublishOptions,
  ): ServiceBusMessage {
    const applicationProperties: {
      [key: string]: string | number | boolean | Date | null;
    } = {
      messageId: envelope.messageId,
      correlationId: envelope.correlationId,
      eventType: envelope.eventType,
      queueName: envelope.queueName,
      sourceSystem: envelope.sourceSystem,
      retryCount: envelope.retryCount,
      createdAt: envelope.createdAt,
    };

    if (options?.applicationProperties) {
      for (const [key, value] of Object.entries(options.applicationProperties)) {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value instanceof Date ||
          value === null
        ) {
          applicationProperties[key] = value;
        } else {
          applicationProperties[key] = String(value);
        }
      }
    }

    if (envelope.metadata) {
      for (const [key, value] of Object.entries(envelope.metadata)) {
        applicationProperties[`meta_${key}`] = value;
      }
    }

    const message: ServiceBusMessage = {
      body: envelope,
      messageId: envelope.messageId,
      correlationId: envelope.correlationId,
      contentType: options?.contentType ?? 'application/json',
      applicationProperties,
    };

    if (options?.subject) {
      message.subject = options.subject;
    }

    return message;
  }

  #buildEnvelopeFromInput<TPayload>(input: PublishInput<TPayload>): MessageEnvelope<TPayload> {
    const params: EnvelopeBuildParams<TPayload> = {
      eventType: input.eventType,
      queueName: input.queueName,
      payload: input.payload,
      sourceSystem: messagingConfig.SOURCE_SYSTEM,
    };

    if (input.options?.correlationId !== undefined) {
      params.correlationId = input.options.correlationId;
    }

    if (input.options?.metadata !== undefined) {
      params.metadata = input.options.metadata;
    }

    return buildEnvelope(params);
  }
}
