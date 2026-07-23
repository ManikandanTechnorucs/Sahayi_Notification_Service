import pino from 'pino';

/**
 * Shared structured logger for all services.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: {
    service: process.env.SERVICE_NAME ?? 'auth-service',
    env: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: [
    'body.password',
    'body.token',
    'body.mobileNumber',
    'req.body.password',
    'req.body.token',
    'req.body.mobileNumber',
    'headers.authorization',
    'req.headers.authorization',
  ],
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
    },
  }),
});
