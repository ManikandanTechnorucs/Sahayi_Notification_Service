import { app, InvocationContext } from '@azure/functions';
import { initializeFirebase } from '../firebase/firebase.config';
import { getContainer } from '../utils/container';
import { logger } from '../utils/logger';
import {
  retryMessageSchema,
  serviceBusNotificationMessageSchema,
} from '../types/validation.schemas';

function parseMessageBody(body: unknown): unknown {
  if (typeof body === 'string') {
    return JSON.parse(body);
  }
  return body;
}

function isRetryMessage(body: Record<string, unknown>): boolean {
  return 'originalMessageId' in body && 'failedDevices' in body;
}

async function handleServiceBusMessage(
  message: unknown,
  context: InvocationContext
): Promise<void> {
  const log = logger.child({ invocationId: context.invocationId });

  try {
    initializeFirebase();
    const container = getContainer();
    const parsedBody = parseMessageBody(message) as Record<string, unknown>;

    if (isRetryMessage(parsedBody)) {
      const validation = retryMessageSchema.safeParse(parsedBody);
      if (!validation.success) {
        log.error('Invalid retry message payload', {
          errors: validation.error.flatten(),
        });
        throw new Error('Invalid retry message payload');
      }

      log.info('Processing retry message', {
        originalMessageId: validation.data.originalMessageId,
        retryCount: validation.data.retryCount,
      });

      await container.notificationService.processRetryMessage(validation.data);
      return;
    }

    const validation = serviceBusNotificationMessageSchema.safeParse(parsedBody);
    if (!validation.success) {
      log.error('Invalid notification message payload', {
        errors: validation.error.flatten(),
      });
      throw new Error('Invalid notification message payload');
    }

    log.info('Processing dispatch message', {
      messageId: validation.data.messageId,
      userId: validation.data.payload.userId,
      eventType: validation.data.payload.eventType,
    });

    await container.notificationService.processDispatchMessage(validation.data);
  } catch (error) {
    log.error('Service Bus message processing failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

app.serviceBusQueue('notificationDispatchTrigger', {
  connection: 'SERVICE_BUS_CONNECTION_STRING',
  queueName: '%SERVICE_BUS_QUEUE_NAME%',
  handler: async (message: unknown, context: InvocationContext) => {
    await handleServiceBusMessage(message, context);
  },
});

app.serviceBusQueue('notificationRetryTrigger', {
  connection: 'SERVICE_BUS_CONNECTION_STRING',
  queueName: '%SERVICE_BUS_RETRY_QUEUE_NAME%',
  handler: async (message: unknown, context: InvocationContext) => {
    await handleServiceBusMessage(message, context);
  },
});
