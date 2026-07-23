import type Long from 'long';

/**
 * Generic message envelope — payload is business-agnostic.
 */
export type MessageEnvelope<TPayload = unknown> = {  messageId: string;
  correlationId: string;
  eventType: string;
  queueName: string;
  payload: TPayload;
  metadata?: Record<string, string>;
  createdAt: string;
  scheduledAt?: string;
  sourceSystem: string;
  retryCount: number;
};

export type PublishOptions = {
  correlationId?: string;
  metadata?: Record<string, string>;
  contentType?: string;
  subject?: string;
  applicationProperties?: Record<string, unknown>;
};

export type ScheduleOptions = PublishOptions & {
  scheduledEnqueueTime: Date;
};

export type ScheduledMessageReference = {
  queueName: string;
  /** Azure Service Bus scheduled message sequence number */
  sequenceNumber: Long;
  scheduledEnqueueTime: Date;
};

export type BatchPublishItem<TPayload = unknown> = {
  envelope: {
    eventType: string;
    payload: TPayload;
    correlationId?: string;
    metadata?: Record<string, string>;
    scheduledAt?: string;
    sourceSystem?: string;
    retryCount?: number;
  };
  options?: PublishOptions;
};
