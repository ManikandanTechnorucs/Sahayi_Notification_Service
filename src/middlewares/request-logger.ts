import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';

/**
 * Lightweight request logger middleware.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
      'http request',
    );
  });

  next();
}
