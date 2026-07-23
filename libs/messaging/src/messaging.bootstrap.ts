import { AzureServiceBusManager } from './core/azure-service-bus.manager';
import { GenericMessagePublisher } from './core/generic-message.publisher';
import { SchedulerService } from './core/scheduler.service';
import { GenericConsumerFramework } from './core/generic-consumer.framework';
import { DeadLetterProcessor } from './core/dead-letter.processor';
import { WorkerRegistry } from './registry/worker.registry';
import { validateMessagingConfig, isMessagingEnabled } from './config/messaging.config';
import { getMessagingHealth } from './observability/health-check';
import { messagingMetrics } from './observability/messaging-metrics';
import { logger } from '../../logger/src/logger';
import { ensureServiceBusQueue } from './admin/service-bus-queue.provisioner';
import { messagingConfig } from './config/messaging.config';

export type MessagingInfrastructure = {
  manager: AzureServiceBusManager;
  publisher: GenericMessagePublisher;
  scheduler: SchedulerService;
  consumer: GenericConsumerFramework;
  deadLetterProcessor: DeadLetterProcessor;
  workerRegistry: WorkerRegistry;
  initialize: () => Promise<void>;
  startWorkers: () => Promise<void>;
  shutdown: () => Promise<void>;
  getHealth: () => ReturnType<typeof getMessagingHealth>;
};

/**
 * Creates the full messaging infrastructure graph (composition root).
 */
export function createMessagingInfrastructure(): MessagingInfrastructure {
  const manager = new AzureServiceBusManager();
  const publisher = new GenericMessagePublisher(manager);
  const scheduler = new SchedulerService(manager);
  const consumer = new GenericConsumerFramework(manager);
  const deadLetterProcessor = new DeadLetterProcessor(manager, publisher);
  const workerRegistry = new WorkerRegistry();

  const initialize = async (): Promise<void> => {
    if (!isMessagingEnabled()) {
      logger.warn(
        { service: 'messaging' },
        messagingConfig.MESSAGING_DISABLED
          ? 'messaging infrastructure skipped (MESSAGING_DISABLED=true)'
          : 'messaging infrastructure skipped (AZURE_SERVICE_BUS_CONNECTION_STRING not set)',
      );
      return;
    }

    validateMessagingConfig();
    await manager.initialize();
  };

  const startWorkers = async (): Promise<void> => {
    if (!isMessagingEnabled()) {
      return;
    }

    const workers = workerRegistry.getAll();

    if (workers.length === 0) {
      logger.warn({ service: 'messaging' }, 'no workers registered — consumers not started');
      return;
    }

    for (const worker of workers) {
      if (messagingConfig.ENSURE_QUEUE_EXISTS) {
        await ensureServiceBusQueue(worker.queueName);
      }

      await consumer.startWorker(worker);
    }

    logger.info(
      { service: 'messaging', workerCount: workers.length },
      'all registered workers started',
    );
  };

  const shutdown = async (): Promise<void> => {
    await consumer.shutdown();
    await manager.shutdown();
    logger.info({ service: 'messaging' }, 'messaging infrastructure shut down');
  };

  const getHealth = () =>
    getMessagingHealth(manager, workerRegistry.count, messagingMetrics.getSnapshot());

  return {
    manager,
    publisher,
    scheduler,
    consumer,
    deadLetterProcessor,
    workerRegistry,
    initialize,
    startWorkers,
    shutdown,
    getHealth,
  };
}
