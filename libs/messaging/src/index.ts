/**
 * Generic Azure Service Bus messaging infrastructure.
 * Business-agnostic — register handlers in application modules.
 */

export { messagingConfig, validateMessagingConfig, isMessagingEnabled } from './config/messaging.config';

export type {
  MessageEnvelope,
  PublishOptions,
  ScheduleOptions,
  ScheduledMessageReference,
  BatchPublishItem,
} from './types/message-envelope';

export type {
  MessageHandler,
  MessageHandlerContext,
  MessageHandlerResult,
} from './types/message-handler';

export type { QueueWorkerConfig, WorkerRegistryEntry } from './types/worker-registration';

export {
  MessagingError,
  MessagingConfigurationError,
  MessagingConnectionError,
  MessagingPublishError,
  MessagingValidationError,
  MessagingScheduleError,
} from './errors/messaging.errors';

export { AzureServiceBusManager } from './core/azure-service-bus.manager';
export { GenericMessagePublisher } from './core/generic-message.publisher';
export type { PublishInput } from './core/generic-message.publisher';
export { SchedulerService } from './core/scheduler.service';
export { GenericConsumerFramework } from './core/generic-consumer.framework';
export { DeadLetterProcessor } from './core/dead-letter.processor';
export type {
  DeadLetterProcessResult,
  DeadLetterProcessorOptions,
} from './core/dead-letter.processor';

export { WorkerRegistry } from './registry/worker.registry';
export { createMessagingInfrastructure } from './messaging.bootstrap';
export type { MessagingInfrastructure } from './messaging.bootstrap';

export { buildMessageEnvelope, parseMessageEnvelope } from './utils/validate-envelope';
export { buildEnvelope } from './utils/envelope-builder.util';
export type { EnvelopeBuildParams } from './utils/envelope-builder.util';
export { maskSensitiveData } from './utils/mask-secrets';

export { messagingMetrics, MessagingMetrics } from './observability/messaging-metrics';
export { getMessagingHealth } from './observability/health-check';
export type { MessagingHealthStatus } from './observability/health-check';

export { ensureServiceBusQueue } from './admin/service-bus-queue.provisioner';
