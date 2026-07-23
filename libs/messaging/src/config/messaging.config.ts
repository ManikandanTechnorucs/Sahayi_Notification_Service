import dotenv from 'dotenv';

dotenv.config();

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"');
  const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'");

  return isDoubleQuoted || isSingleQuoted ? trimmed.slice(1, -1) : trimmed;
};

const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];

  if (!value) {
    return undefined;
  }

  return stripWrappingQuotes(value);
};

const getRequiredEnv = (key: string): string => {
  const value = getOptionalEnv(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Messaging infrastructure configuration loaded from environment variables.
 * No queue names or business identifiers are hardcoded here.
 */
export const messagingConfig = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  SERVICE_NAME: getOptionalEnv('SERVICE_NAME') ?? 'sahayi-enterprise',
  SOURCE_SYSTEM: getOptionalEnv('MESSAGING_SOURCE_SYSTEM') ?? getOptionalEnv('SERVICE_NAME') ?? 'sahayi-enterprise',

  /** Connection string — required when messaging is enabled */
  SERVICE_BUS_CONNECTION_STRING:
    getOptionalEnv('AZURE_SERVICE_BUS_CONNECTION_STRING') ??
    getOptionalEnv('ASB_CONNECTION_STRING'),

  /** Set to "true" to allow lazy init without connection string (e.g. unit tests) */
  MESSAGING_DISABLED: getOptionalEnv('MESSAGING_DISABLED') === 'true',

  DEFAULT_MAX_DELIVERY_COUNT: parsePositiveInt(
    getOptionalEnv('MESSAGING_DEFAULT_MAX_DELIVERY_COUNT'),
    10,
  ),
  DEFAULT_WORKER_CONCURRENCY: parsePositiveInt(
    getOptionalEnv('MESSAGING_DEFAULT_WORKER_CONCURRENCY'),
    5,
  ),
  DEFAULT_MAX_AUTO_LOCK_RENEWAL_MS: parsePositiveInt(
    getOptionalEnv('MESSAGING_DEFAULT_MAX_AUTO_LOCK_RENEWAL_MS'),
    300_000,
  ),
  DEFAULT_RECEIVE_MODE: (getOptionalEnv('MESSAGING_RECEIVE_MODE') ?? 'peekLock') as
    | 'peekLock'
    | 'receiveAndDelete',
  DEFAULT_RETRY_DELAY_MS: parsePositiveInt(getOptionalEnv('MESSAGING_DEFAULT_RETRY_DELAY_MS'), 1000),
  DEFAULT_MAX_RETRY_ATTEMPTS: parsePositiveInt(
    getOptionalEnv('MESSAGING_DEFAULT_MAX_RETRY_ATTEMPTS'),
    3,
  ),
  SHUTDOWN_TIMEOUT_MS: parsePositiveInt(getOptionalEnv('MESSAGING_SHUTDOWN_TIMEOUT_MS'), 30_000),
  HEALTH_CHECK_ENABLED: getOptionalEnv('MESSAGING_HEALTH_CHECK_ENABLED') !== 'false',
  METRICS_ENABLED: getOptionalEnv('MESSAGING_METRICS_ENABLED') !== 'false',
  LOG_PAYLOAD: getOptionalEnv('MESSAGING_LOG_PAYLOAD') === 'true',
  DLQ_MAX_MESSAGES_PER_RUN: parsePositiveInt(
    getOptionalEnv('MESSAGING_DLQ_MAX_MESSAGES_PER_RUN'),
    50,
  ),
  DLQ_REPROCESS_ENABLED: getOptionalEnv('MESSAGING_DLQ_REPROCESS_ENABLED') === 'true',

  /** When true, creates missing queues at startup (requires Manage on SAS policy) */
  ENSURE_QUEUE_EXISTS:
    getOptionalEnv('MESSAGING_ENSURE_QUEUE') !== 'false' &&
    (process.env.NODE_ENV ?? 'development') !== 'production',
};

/**
 * Validates that messaging can be used (connection string present unless disabled).
 */
export function validateMessagingConfig(): void {
  if (messagingConfig.MESSAGING_DISABLED) {
    return;
  }

  const connectionString =
    getOptionalEnv('AZURE_SERVICE_BUS_CONNECTION_STRING') ??
    getOptionalEnv('ASB_CONNECTION_STRING');

  if (!connectionString) {
    throw new Error(
      'Missing required environment variable: AZURE_SERVICE_BUS_CONNECTION_STRING (or ASB_CONNECTION_STRING)',
    );
  }
}

export function isMessagingEnabled(): boolean {
  return !messagingConfig.MESSAGING_DISABLED && Boolean(messagingConfig.SERVICE_BUS_CONNECTION_STRING);
}
