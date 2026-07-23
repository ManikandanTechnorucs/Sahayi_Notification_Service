import { createHmac } from 'node:crypto';
import { ServiceBusClient } from '@azure/service-bus';
import { messagingConfig } from '../config/messaging.config';
import { MessagingConfigurationError } from '../errors/messaging.errors';
import { logger } from '../../../logger/src/logger';

type ServiceBusConnectionParts = {
  host: string;
  sharedAccessKeyName: string;
  sharedAccessKey: string;
};

const parseConnectionString = (connectionString: string): ServiceBusConnectionParts => {
  const parts = Object.fromEntries(
    connectionString
      .split(';')
      .filter(Boolean)
      .map((segment) => {
        const index = segment.indexOf('=');
        if (index === -1) {
          return [segment, ''];
        }
        return [segment.slice(0, index), segment.slice(index + 1)];
      }),
  );

  const endpoint = parts.Endpoint;

  if (!endpoint || !parts.SharedAccessKeyName || !parts.SharedAccessKey) {
    throw new MessagingConfigurationError(
      'Invalid AZURE_SERVICE_BUS_CONNECTION_STRING — requires Endpoint, SharedAccessKeyName, SharedAccessKey',
    );
  }

  const host = endpoint.replace('sb://', '').replace(/\/$/, '');

  return {
    host,
    sharedAccessKeyName: parts.SharedAccessKeyName,
    sharedAccessKey: parts.SharedAccessKey,
  };
};

const buildSharedAccessSignature = (
  resourceUri: string,
  keyName: string,
  key: string,
): string => {
  const encodedUri = encodeURIComponent(resourceUri);
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const signaturePayload = `${encodedUri}\n${expires}`;
  const signature = createHmac('sha256', key)
    .update(signaturePayload, 'utf8')
    .digest('base64');

  return `SharedAccessSignature sr=${encodedUri}&sig=${encodeURIComponent(signature)}&se=${expires}&skn=${encodeURIComponent(keyName)}`;
};

const queueResourceUri = (host: string, queueName: string): string =>
  `https://${host}/${queueName}`;

const isQueueMissingError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as { code?: string; message?: string };

  return (
    err.code === 'MessagingEntityNotFound' ||
    Boolean(err.message?.includes('could not be found'))
  );
};

/**
 * Verifies the queue is reachable using the Service Bus SDK (not only management API).
 */
const isQueueOperational = async (
  queueName: string,
  connectionString: string,
): Promise<boolean> => {
  const client = new ServiceBusClient(connectionString);

  try {
    const sender = client.createSender(queueName);
    await sender.createMessageBatch();
    await sender.close();
    return true;
  } catch (error) {
    if (isQueueMissingError(error)) {
      return false;
    }

    throw error;
  } finally {
    await client.close();
  }
};

const queueExistsInManagementApi = async (
  host: string,
  queueName: string,
  connection: ServiceBusConnectionParts,
): Promise<boolean> => {
  const resourceUri = queueResourceUri(host, queueName);
  const token = buildSharedAccessSignature(
    resourceUri,
    connection.sharedAccessKeyName,
    connection.sharedAccessKey,
  );

  const response = await fetch(resourceUri, {
    method: 'GET',
    headers: {
      Authorization: token,
      'Content-Type': 'application/atom+xml;type=feed;charset=utf-8',
    },
  });

  if (response.status !== 200) {
    return false;
  }

  const body = await response.text();
  return body.includes('QueueDescription') && body.includes(queueName);
};

const createQueue = async (
  host: string,
  queueName: string,
  connection: ServiceBusConnectionParts,
): Promise<void> => {
  const resourceUri = queueResourceUri(host, queueName);
  const token = buildSharedAccessSignature(
    resourceUri,
    connection.sharedAccessKeyName,
    connection.sharedAccessKey,
  );

  const body = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom">
  <title>${queueName}</title>
  <content type="application/xml">
    <QueueDescription xmlns="http://schemas.microsoft.com/netservices/2010/10/servicebus/connect">
      <LockDuration>PT1M</LockDuration>
      <MaxSizeInMegabytes>1024</MaxSizeInMegabytes>
      <RequiresDuplicateDetection>false</RequiresDuplicateDetection>
      <RequiresSession>false</RequiresSession>
      <DefaultMessageTimeToLive>P14D</DefaultMessageTimeToLive>
      <DeadLetteringOnMessageExpiration>true</DeadLetteringOnMessageExpiration>
      <EnableBatchedOperations>true</EnableBatchedOperations>
      <MaxDeliveryCount>10</MaxDeliveryCount>
    </QueueDescription>
  </content>
</entry>`;

  const response = await fetch(resourceUri, {
    method: 'PUT',
    headers: {
      Authorization: token,
      'Content-Type': 'application/atom+xml;type=entry;charset=utf-8',
    },
    body,
  });

  if (response.status === 201 || response.status === 200 || response.status === 409) {
    return;
  }

  const errorText = await response.text().catch(() => '');

  throw new MessagingConfigurationError(
    `Failed to create Service Bus queue "${queueName}" (${response.status}): ${errorText}`,
  );
};

const waitForQueueReady = async (
  queueName: string,
  connectionString: string,
  attempts = 5,
): Promise<void> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await isQueueOperational(queueName, connectionString)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }

  throw new MessagingConfigurationError(
    `Queue "${queueName}" was created but is not yet available. Retry in a few seconds.`,
  );
};

/**
 * Ensures a queue exists in the namespace (creates it when missing and allowed).
 */
export async function ensureServiceBusQueue(queueName: string): Promise<void> {
  const connectionString = messagingConfig.SERVICE_BUS_CONNECTION_STRING;

  if (!connectionString) {
    throw new MessagingConfigurationError('AZURE_SERVICE_BUS_CONNECTION_STRING is not configured');
  }

  if (await isQueueOperational(queueName, connectionString)) {
    logger.info(
      { service: 'messaging', queueName },
      'service bus queue is ready',
    );
    return;
  }

  const connection = parseConnectionString(connectionString);

  logger.warn(
    { service: 'messaging', queueName, namespace: connection.host },
    'service bus queue missing or not operational — creating queue',
  );

  if (!(await queueExistsInManagementApi(connection.host, queueName, connection))) {
    await createQueue(connection.host, queueName, connection);
  } else {
    logger.warn(
      { service: 'messaging', queueName },
      'management API reports queue exists but SDK cannot connect — waiting for propagation',
    );
  }

  await waitForQueueReady(queueName, connectionString);

  logger.info(
    { service: 'messaging', queueName, namespace: connection.host },
    'service bus queue is ready',
  );
}
