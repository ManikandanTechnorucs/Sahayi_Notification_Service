import dotenv from 'dotenv';
import { existsSync } from 'node:fs';

dotenv.config();

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  const isDoubleQuoted = trimmed.startsWith('"') && trimmed.endsWith('"');
  const isSingleQuoted = trimmed.startsWith("'") && trimmed.endsWith("'");

  return isDoubleQuoted || isSingleQuoted ? trimmed.slice(1, -1) : trimmed;
};

/**
 * Reads a required environment variable.
 */
const getRequiredEnv = (key: string): string => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return stripWrappingQuotes(value);
};

/**
 * Reads an optional environment variable.
 */
const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];

  if (!value) {
    return undefined;
  }

  return stripWrappingQuotes(value);
};

const isRunningInDocker = (): boolean => existsSync('/.dockerenv');

const normalizeDatabaseUrl = (databaseUrl: string): string => {
  if (!isRunningInDocker()) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);

  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    url.hostname = 'host.docker.internal';
  }

  return url.toString();
};

const parsePositiveIntEnv = (key: string, fallback: number): number => {
  const raw = getOptionalEnv(key);

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Shared runtime configuration loaded from environment variables.
 */
export const config = {
  DATABASE_URL: normalizeDatabaseUrl(getRequiredEnv('DATABASE_URL')),
  JWT_SECRET: process.env.JWT_SECRET || 'asdkjhkjkkkh987879879879987khkas',
  REMINDER_DEFAULT_STATUS_NAME: getOptionalEnv('REMINDER_DEFAULT_STATUS_NAME'),
  REMINDER_LIST_DEFAULT_STATUS_NAME:
    getOptionalEnv('REMINDER_LIST_DEFAULT_STATUS_NAME') ??
    getOptionalEnv('REMINDER_DEFAULT_STATUS_NAME'),
  REMINDER_DEFAULT_PAGE: parsePositiveIntEnv('REMINDER_DEFAULT_PAGE', 1),
  REMINDER_DEFAULT_PAGE_SIZE: parsePositiveIntEnv('REMINDER_DEFAULT_PAGE_SIZE', 20),
  REMINDER_MAX_PAGE_SIZE: parsePositiveIntEnv('REMINDER_MAX_PAGE_SIZE', 100),
  REMINDER_MAX_SEARCH_LENGTH: parsePositiveIntEnv('REMINDER_MAX_SEARCH_LENGTH', 100),
  REMINDER_MAX_OCCURRENCES: parsePositiveIntEnv('REMINDER_MAX_OCCURRENCES', 365),
  REMINDER_BEFORE_OFFSET_MINUTES: parsePositiveIntEnv('REMINDER_BEFORE_OFFSET_MINUTES', 5),
  REMINDER_AFTER_OFFSET_MINUTES: parsePositiveIntEnv('REMINDER_AFTER_OFFSET_MINUTES', 5),
  REMINDER_SYNC_INTERVAL_MS: parsePositiveIntEnv('REMINDER_SYNC_INTERVAL_MS', 300_000),
  /** IANA timezone for reminder wall-clock times (app users are India-based). */
  REMINDER_TIMEZONE: getOptionalEnv('REMINDER_TIMEZONE') ?? 'Asia/Kolkata',
  NOTIFICATION_SERVICE_PORT: Number(process.env.NOTIFICATION_SERVICE_PORT ?? 3004),
  DELIVERED_NOTIFICATION_DEFAULT_PAGE: parsePositiveIntEnv(
    'DELIVERED_NOTIFICATION_DEFAULT_PAGE',
    1,
  ),
  DELIVERED_NOTIFICATION_DEFAULT_LIMIT: parsePositiveIntEnv(
    'DELIVERED_NOTIFICATION_DEFAULT_LIMIT',
    30,
  ),
  DELIVERED_NOTIFICATION_MAX_LIMIT: parsePositiveIntEnv(
    'DELIVERED_NOTIFICATION_MAX_LIMIT',
    30,
  ),
  /** Shared Azure Service Bus queue for all notification dispatch events */
  NOTIFICATION_QUEUE_NAME:
    getOptionalEnv('NOTIFICATION_QUEUE_NAME') ?? 'notifications',
  NOTIFICATION_DEFAULT_CHANNELS: (
    getOptionalEnv('NOTIFICATION_DEFAULT_CHANNELS') ?? 'push'
  )
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0) as Array<'push' | 'email' | 'sms' | 'in_app'>,
  FCM_ENABLED: getOptionalEnv('FCM_ENABLED') === 'true',
  FCM_PROJECT_ID: getOptionalEnv('FCM_PROJECT_ID'),
  FCM_SERVICE_ACCOUNT_PATH: getOptionalEnv('FCM_SERVICE_ACCOUNT_PATH'),
};
