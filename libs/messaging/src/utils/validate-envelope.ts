import { z } from 'zod';
import { MessagingValidationError } from '../errors/messaging.errors';
import type { MessageEnvelope } from '../types/message-envelope';

const envelopeSchema = z.object({
  messageId: z.string().min(1),
  correlationId: z.string().min(1),
  eventType: z.string().min(1),
  queueName: z.string().min(1),
  payload: z.unknown(),
  metadata: z.record(z.string(), z.string()).optional(),
  createdAt: z.string().min(1),
  scheduledAt: z.string().optional(),
  sourceSystem: z.string().min(1),
  retryCount: z.number().int().nonnegative(),
});

/**
 * Parses and validates a message envelope from a received Service Bus message body.
 */
export function parseMessageEnvelope(body: unknown): MessageEnvelope {
  let parsed: unknown = body;

  if (Buffer.isBuffer(body)) {
    parsed = JSON.parse(body.toString('utf8'));
  } else if (typeof body === 'string') {
    parsed = JSON.parse(body);
  }

  const result = envelopeSchema.safeParse(parsed);

  if (!result.success) {
    throw new MessagingValidationError(
      result.error.issues.map((issue) => issue.message).join('; ') || 'Invalid message envelope',
    );
  }

  return result.data as MessageEnvelope;
}

/**
 * Builds a new envelope for publishing.
 */
export function buildMessageEnvelope<TPayload>(input: {
  eventType: string;
  queueName: string;
  payload: TPayload;
  correlationId?: string;
  metadata?: Record<string, string>;
  scheduledAt?: Date;
  retryCount?: number;
  sourceSystem: string;
}): MessageEnvelope<TPayload> {
  const messageId = crypto.randomUUID();
  const correlationId = input.correlationId ?? messageId;

  const envelope: MessageEnvelope<TPayload> = {
    messageId,
    correlationId,
    eventType: input.eventType,
    queueName: input.queueName,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    sourceSystem: input.sourceSystem,
    retryCount: input.retryCount ?? 0,
  };

  if (input.metadata !== undefined) {
    envelope.metadata = input.metadata;
  }

  if (input.scheduledAt !== undefined) {
    envelope.scheduledAt = input.scheduledAt.toISOString();
  }

  return envelope;
}
