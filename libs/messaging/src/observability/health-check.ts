import type { AzureServiceBusManager } from '../core/azure-service-bus.manager';
import { isMessagingEnabled, messagingConfig } from '../config/messaging.config';

export type MessagingHealthStatus = {
  status: 'healthy' | 'degraded' | 'disabled';
  messagingEnabled: boolean;
  clientInitialized: boolean;
  activeProcessors: number;
  registeredWorkers: number;
  metrics?: ReturnType<import('./messaging-metrics').MessagingMetrics['getSnapshot']>;
};

/**
 * Returns health information for messaging infrastructure.
 */
export function getMessagingHealth(
  manager: AzureServiceBusManager,
  registeredWorkers: number,
  metricsSnapshot?: ReturnType<import('./messaging-metrics').MessagingMetrics['getSnapshot']>,
): MessagingHealthStatus {
  if (!isMessagingEnabled()) {
    return {
      status: 'disabled',
      messagingEnabled: false,
      clientInitialized: false,
      activeProcessors: 0,
      registeredWorkers,
    };
  }

  const clientInitialized = manager.isInitialized();
  const activeProcessors = manager.getActiveProcessorCount();

  const status =
    clientInitialized && messagingConfig.HEALTH_CHECK_ENABLED
      ? 'healthy'
      : clientInitialized
        ? 'healthy'
        : 'degraded';

  const health: MessagingHealthStatus = {
    status,
    messagingEnabled: true,
    clientInitialized,
    activeProcessors,
    registeredWorkers,
  };

  if (metricsSnapshot) {
    health.metrics = metricsSnapshot;
  }

  return health;
}
