import type { MessageEnvelope } from '../types/message-envelope';
import { buildMessageEnvelope } from './validate-envelope';

export type EnvelopeBuildParams<TPayload = unknown> = {
  eventType: string;
  queueName: string;
  payload: TPayload;
  sourceSystem: string;
  correlationId?: string;
  metadata?: Record<string, string>;
  scheduledAt?: Date;
  retryCount?: number;
};

/**
 * Builds an envelope without passing explicit `undefined` optional fields (exactOptionalPropertyTypes).
 */
export function buildEnvelope<TPayload>(params: EnvelopeBuildParams<TPayload>): MessageEnvelope<TPayload> {
  const input: EnvelopeBuildParams<TPayload> = {
    eventType: params.eventType,
    queueName: params.queueName,
    payload: params.payload,
    sourceSystem: params.sourceSystem,
  };

  if (params.correlationId !== undefined) {
    input.correlationId = params.correlationId;
  }

  if (params.metadata !== undefined) {
    input.metadata = params.metadata;
  }

  if (params.scheduledAt !== undefined) {
    input.scheduledAt = params.scheduledAt;
  }

  if (params.retryCount !== undefined) {
    input.retryCount = params.retryCount;
  }

  return buildMessageEnvelope(input);
}
