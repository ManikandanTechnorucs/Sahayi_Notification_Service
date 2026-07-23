/**
 * Example: register workers in an application module (e.g. reminder-worker, notification-worker).
 * Queue names come from environment variables — never hardcode in the framework.
 */

import {
  createMessagingInfrastructure,
  type MessageHandler,
  type MessageHandlerContext,
  type MessageHandlerResult,
} from '../src/index';

/** Example handler — replace with real business logic in apps/ */
class ExampleJobHandler implements MessageHandler<{ jobId: string }> {
  readonly name = 'example-job-handler';
  readonly supportedEventTypes = ['job.process'] as const;

  async handle(
    context: MessageHandlerContext & { envelope: { payload: { jobId: string } } },
  ): Promise<MessageHandlerResult> {
    // Business logic lives here — not in libs/messaging
    console.log('Processing job', context.envelope.payload.jobId);
    return { complete: true };
  }
}

async function main(): Promise<void> {
  const messaging = createMessagingInfrastructure();

  const queueName = process.env.EXAMPLE_QUEUE_NAME;

  if (!queueName) {
    throw new Error('Set EXAMPLE_QUEUE_NAME in environment');
  }

  messaging.workerRegistry.register({
    queueName,
    handler: new ExampleJobHandler(),
    concurrency: Number(process.env.EXAMPLE_WORKER_CONCURRENCY ?? 5),
  });

  await messaging.initialize();
  await messaging.startWorkers();

  const shutdown = async (): Promise<void> => {
    await messaging.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
