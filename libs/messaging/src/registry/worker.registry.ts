import type { QueueWorkerConfig, WorkerRegistryEntry } from '../types/worker-registration';
import type { MessageHandler } from '../types/message-handler';
import { MessagingConfigurationError } from '../errors/messaging.errors';
import { logger } from '../../../logger/src/logger';

/**
 * Dynamic worker registration — applications register handlers without changing core infrastructure.
 */
export class WorkerRegistry {
  readonly #workers = new Map<string, WorkerRegistryEntry>();

  /**
   * Registers a queue worker (queue name must be unique).
   */
  register(config: QueueWorkerConfig): void {
    const queueName = config.queueName.trim();

    if (!queueName) {
      throw new MessagingConfigurationError('queueName is required for worker registration');
    }

    if (this.#workers.has(queueName)) {
      throw new MessagingConfigurationError(
        `Worker already registered for queue: ${queueName}`,
      );
    }

    if (!config.handler?.name) {
      throw new MessagingConfigurationError('handler must implement MessageHandler with a name');
    }

    const entry: WorkerRegistryEntry = {
      ...config,
      queueName,
      registeredAt: new Date().toISOString(),
    };

    this.#workers.set(queueName, entry);

    logger.info(
      {
        service: 'messaging',
        queueName,
        handler: config.handler.name,
        concurrency: config.concurrency,
      },
      'worker registered',
    );
  }

  /**
   * Registers multiple workers at once.
   */
  registerAll(configs: QueueWorkerConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  get(queueName: string): WorkerRegistryEntry | undefined {
    return this.#workers.get(queueName);
  }

  getAll(): WorkerRegistryEntry[] {
    return [...this.#workers.values()];
  }

  getHandler(queueName: string): MessageHandler | undefined {
    return this.#workers.get(queueName)?.handler;
  }

  get count(): number {
    return this.#workers.size;
  }

  clear(): void {
    this.#workers.clear();
  }
}
