import type { AzureServiceBusManager } from './azure-service-bus.manager';
import { messagingConfig } from '../config/messaging.config';
import { MessagingScheduleError } from '../errors/messaging.errors';
import type { PublishInput } from './generic-message.publisher';
import type { ScheduledMessageReference } from '../types/message-envelope';
import { buildEnvelope, type EnvelopeBuildParams } from '../utils/envelope-builder.util';
import { logger } from '../../../logger/src/logger';

/**
 * Schedules and cancels future queue messages.
 */
export class SchedulerService {
  readonly #manager: AzureServiceBusManager;

  constructor(manager: AzureServiceBusManager) {
    this.#manager = manager;
  }

  /**
   * Schedules a message for future delivery.
   */
  async schedule<TPayload>(
    input: PublishInput<TPayload> & { scheduledEnqueueTime: Date },
  ): Promise<ScheduledMessageReference> {
    if (input.scheduledEnqueueTime.getTime() <= Date.now()) {
      throw new MessagingScheduleError('scheduledEnqueueTime must be in the future');
    }

    const params: EnvelopeBuildParams<TPayload> = {
      eventType: input.eventType,
      queueName: input.queueName,
      payload: input.payload,
      scheduledAt: input.scheduledEnqueueTime,
      sourceSystem: messagingConfig.SOURCE_SYSTEM,
    };

    if (input.options?.correlationId !== undefined) {
      params.correlationId = input.options.correlationId;
    }

    if (input.options?.metadata !== undefined) {
      params.metadata = input.options.metadata;
    }

    const envelope = buildEnvelope(params);

    try {
      const sender = this.#manager.getSender(input.queueName);
      const sequenceNumbers = await sender.scheduleMessages(
        {
          body: envelope,
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          contentType: input.options?.contentType ?? 'application/json',
          applicationProperties: {
            messageId: envelope.messageId,
            correlationId: envelope.correlationId,
            eventType: envelope.eventType,
            queueName: envelope.queueName,
            sourceSystem: envelope.sourceSystem,
            ...(envelope.scheduledAt ? { scheduledAt: envelope.scheduledAt } : {}),
          },
        },
        input.scheduledEnqueueTime,
      );

      const sequenceNumber = sequenceNumbers[0];

      if (!sequenceNumber) {
        throw new MessagingScheduleError('No sequence number returned from schedule operation');
      }

      logger.info(
        {
          service: 'messaging',
          queueName: input.queueName,
          messageId: envelope.messageId,
          correlationId: envelope.correlationId,
          scheduledEnqueueTime: input.scheduledEnqueueTime.toISOString(),
          sequenceNumber: sequenceNumber.toString(),
        },
        'message scheduled',
      );

      return {
        queueName: input.queueName,
        sequenceNumber,
        scheduledEnqueueTime: input.scheduledEnqueueTime,
      };
    } catch (error) {
      if (error instanceof MessagingScheduleError) {
        throw error;
      }

      throw new MessagingScheduleError(
        error instanceof Error ? error.message : 'Failed to schedule message',
      );
    }
  }

  /**
   * Cancels a previously scheduled message by sequence number.
   */
  async cancelScheduled(
    queueName: string,
    sequenceNumber: ScheduledMessageReference['sequenceNumber'],
  ): Promise<void> {
    try {
      const sender = this.#manager.getSender(queueName);
      await sender.cancelScheduledMessages(sequenceNumber);

      logger.info(
        {
          service: 'messaging',
          queueName,
          sequenceNumber: sequenceNumber.toString(),
        },
        'scheduled message cancelled',
      );
    } catch (error) {
      throw new MessagingScheduleError(
        error instanceof Error ? error.message : 'Failed to cancel scheduled message',
        false,
      );
    }
  }
}
