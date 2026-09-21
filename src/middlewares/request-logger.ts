import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../libs/logger/src/logger';

export type RequestWithTelemetry = Request & {
  requestId?: string;
  startedAt?: number;
  log?: ReturnType<typeof logger.child>;
};

/**
 * Lightweight request logger middleware.
 */
export function requestLogger(req: RequestWithTelemetry, res: Response, next: NextFunction): void {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  req.requestId = requestId ?? randomUUID();
  req.startedAt = Date.now();

  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - (req.startedAt ?? Date.now()),
        requestId: req.requestId,
      },
      'http request',
    );
  });

  next();
}
