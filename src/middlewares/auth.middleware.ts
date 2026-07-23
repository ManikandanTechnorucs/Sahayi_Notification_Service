import type { NextFunction, Request, Response } from 'express';
import { verifyToken, type AuthTokenPayload } from '../../libs/auth/src/jwt';
import { response } from '../../libs/response/src/response';
import { UnauthorizedError } from '../errors/app-error';

export type AuthenticatedRequest = Request & {
  user?: AuthTokenPayload;
};

/**
 * Requires a valid Bearer JWT on the Authorization header.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      res.status(401).json(response.UNAUTHORIZED);
      return;
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      res.status(401).json(response.UNAUTHORIZED);
      return;
    }

    const decoded = verifyToken(token);

    if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
      throw new UnauthorizedError();
    }

    const payload = decoded as AuthTokenPayload & { purpose?: string };

    if (payload.purpose === 'otp_verification') {
      res.status(401).json(response.UNAUTHORIZED);
      return;
    }

    if (!payload.id || !payload.role) {
      res.status(401).json(response.UNAUTHORIZED);
      return;
    }

    req.user = {
      id: String(payload.id),
      role: String(payload.role),
      ...(payload.purpose ? { purpose: payload.purpose } : {}),
    };

    next();
  } catch {
    res.status(401).json(response.UNAUTHORIZED);
  }
}
