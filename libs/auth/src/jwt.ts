import jwt, { type JwtPayload } from 'jsonwebtoken';
import { config } from '../../config/src/config';

export type AuthTokenPayload = {
  id: string;
  role: string;
  purpose?: 'access' | 'otp_verification';
  sv?: number;
};

/**
 * Verifies a signed auth token.
 */
export const verifyToken = (token: string): string | JwtPayload => {
  return jwt.verify(token, config.JWT_SECRET);
};
