import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/request-logger';
import { createScheduledNotificationRoutes } from './routes/scheduled-notification.routes';
import { openApiDocument } from './swagger/openapi';
import type { AppContainer } from './utils/container';

/**
 * Builds the Express application (listen is done in server.ts).
 */
export function createApp(container: AppContainer) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      code: 200,
      message: 'OK',
      data: {
        service: 'notification-service',
        messaging: container.messaging.getHealth(),
      },
    });
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api-docs.json', (_req, res) => {
    res.status(200).json(openApiDocument);
  });

  app.use(
    '/notifications',
    createScheduledNotificationRoutes(container.scheduledNotificationController),
  );

  app.use(errorHandler);

  return app;
}
