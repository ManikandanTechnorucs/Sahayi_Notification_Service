import type { MessageHandler } from './message-handler';

/**
 * Queue worker configuration — queue name comes from env/config per deployment, not hardcoded in framework.
 */
export type QueueWorkerConfig = {
  /** Logical queue name (must match Azure queue name for that worker) */
  queueName: string;
  /** Handler instance injected by the application module */
  handler: MessageHandler;
  /** Override default concurrency for this worker */
  concurrency?: number;
  /** Override max auto lock renewal (ms) */
  maxAutoLockRenewalDurationInMs?: number;
  /** Max concurrent calls per processor instance */
  maxConcurrentCalls?: number;
  /** Enable dead-letter sub-queue processing for this worker */
  enableDeadLetterProcessing?: boolean;
  /** Receive mode override */
  receiveMode?: 'peekLock' | 'receiveAndDelete';
  /** Max delivery count before DLQ (informational; Azure entity config is source of truth) */
  maxDeliveryCount?: number;
};

export type WorkerRegistryEntry = QueueWorkerConfig & {
  registeredAt: string;
};
