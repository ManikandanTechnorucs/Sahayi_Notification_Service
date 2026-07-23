import { config } from '../libs/config/src/config';
import { logger } from '../libs/logger/src/logger';
import { createApp } from './app';
import { createContainer } from './utils/container';

/**
 * Starts the Notification Service HTTP server on port 3004 (default).
 */
async function bootstrap(): Promise<void> {
  const container = createContainer();

  await container.messaging.initialize();

  const app = createApp(container);
  const port = config.NOTIFICATION_SERVICE_PORT;

  const server = app.listen(port, () => {
    logger.info(
      {
        port,
        swagger: `http://localhost:${port}/api-docs`,
      },
      'notification service listening',
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down notification service');

    server.close(async () => {
      try {
        await container.messaging.shutdown();
      } catch (error) {
        logger.error({ err: error }, 'messaging shutdown failed');
      } finally {
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  logger.error({ err: error }, 'failed to start notification service');
  process.exit(1);
});
