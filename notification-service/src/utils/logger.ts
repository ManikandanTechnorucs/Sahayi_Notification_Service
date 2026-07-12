import winston from 'winston';

const logLevel = process.env.LOG_LEVEL ?? 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'sahayi-push-notification-service' },
  transports: [new winston.transports.Console()],
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
