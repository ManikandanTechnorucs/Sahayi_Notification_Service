const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'authorization',
  'connectionstring',
  'connection_string',
  'apikey',
  'api_key',
];

/**
 * Masks sensitive values in objects for safe logging.
 */
export function maskSensitiveData<T extends Record<string, unknown>>(data: T): T {
  const masked = { ...data };

  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      masked[key as keyof T] = '[REDACTED]' as T[keyof T];
      continue;
    }

    const value = masked[key as keyof T];

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      masked[key as keyof T] = maskSensitiveData(value as Record<string, unknown>) as T[keyof T];
    }
  }

  return masked;
}
