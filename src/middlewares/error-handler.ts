import type { NextFunction, Response } from 'express';
import { response } from '../../libs/response/src/response';
import { logger } from '../../libs/logger/src/logger';
import { SERVICE_NAME } from '../constants/service.constants';
import { AppError } from '../errors/app-error';
import { recordFailedApiRequest } from '../telemetry/record-failed-api-request';
import type { RequestWithTelemetry } from './request-logger';

type ErrorLike = Error & {
  statusCode?: number;
  code?: string;
  message: string;
  isOperational?: boolean;
  errors?: Array<{ field: string; message: string }>;
};

function trackFailedRequest(
  req: RequestWithTelemetry,
  statusCode: number,
  errorMessage: string,
  err: ErrorLike,
): void {
  recordFailedApiRequest({
    serviceName: SERVICE_NAME,
    endpoint: req.originalUrl || req.url || 'unknown',
    method: req.method,
    statusCode,
    errorMessage,
    occurredAt: new Date().toISOString(),
    error: err,
    ...(err.name ? { errorName: err.name } : {}),
    ...(typeof req.startedAt === 'number' ? { durationMs: Date.now() - req.startedAt } : {}),
    ...(req.requestId ? { correlationId: req.requestId } : {}),
  });
}

/**
 * Global Express error handler — must be registered last.
 */
export function errorHandler(
  err: ErrorLike,
  req: RequestWithTelemetry,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'Request failed';

  if (!(err instanceof AppError) && !err.isOperational) {
    logger.error({ err }, 'Unhandled error');
  }

  if (statusCode === 401) {
    trackFailedRequest(req, statusCode, response.UNAUTHORIZED.message, err);
    res.status(401).json(response.UNAUTHORIZED);
    return;
  }

  if (statusCode >= 500) {
    trackFailedRequest(req, statusCode, response.OOPS_ERROR.message, err);
    res.status(500).json(response.OOPS_ERROR);
    return;
  }

  trackFailedRequest(req, statusCode, message, err);
  res.status(statusCode).json(response.createError(message, code, err.errors));
}
