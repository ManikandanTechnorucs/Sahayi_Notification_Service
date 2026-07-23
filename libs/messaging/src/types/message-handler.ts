import type { ProcessErrorArgs, ServiceBusReceivedMessage } from '@azure/service-bus';
import type { MessageEnvelope } from './message-envelope';

/**
 * Context passed to business handlers — no business types in the framework.
 */
export type MessageHandlerContext = {
  queueName: string;
  receivedMessage: ServiceBusReceivedMessage;
  envelope: MessageEnvelope;
  deliveryCount: number;
  correlationId: string;
  startedAt: Date;
};

export type MessageHandlerResult = {
  /** When true, message is completed (removed from queue). Default true. */
  complete?: boolean;
  /** When true, message is abandoned for retry. Mutually exclusive with complete. */
  abandon?: boolean;
  /** When true, message is dead-lettered. */
  deadLetter?: boolean;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
};

/**
 * Contract every business module implements (ReminderHandler, EmailHandler, etc.).
 */
export interface MessageHandler<TPayload = unknown> {
  /** Unique handler name for logging and diagnostics */
  readonly name: string;
  /** Event types this handler accepts (empty = accept all on registered queue) */
  readonly supportedEventTypes?: readonly string[];
  handle(context: MessageHandlerContext & { envelope: MessageEnvelope<TPayload> }): Promise<MessageHandlerResult | void>;
  onError?(error: Error, context: MessageHandlerContext, args?: ProcessErrorArgs): Promise<void>;
}
