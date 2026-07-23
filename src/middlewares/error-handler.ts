import type { NextFunction, Request, Response } from 'express';
import { response } from '../../libs/response/src/response';
import { logger } from '../../libs/logger/src/logger';
import { AppError } from '../errors/app-error';

type ErrorLike = {
  statusCode?: number;
  code?: string;
  message?: string;
  isOperational?: boolean;
  errors?: Array<{ field: string; message: string }>;
};

/**
 * Global Express error handler — must be registered last.
 */
export function errorHandler(
  err: ErrorLike,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';

  if (!(err instanceof AppError) && !err.isOperational) {
    logger.error({ err }, 'Unhandled error');
  }

  if (statusCode === 401) {
    res.status(401).json(response.UNAUTHORIZED);
    return;
  }

  if (statusCode >= 500) {
    res.status(500).json(response.OOPS_ERROR);
    return;
  }

  res.status(statusCode).json(
    response.createError(err.message ?? 'Request failed', code, err.errors),
  );
}
