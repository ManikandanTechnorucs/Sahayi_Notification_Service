import { prisma } from '../../libs/db/src/prisma';
import { UnauthorizedError } from '../errors/app-error';

const SESSION_SUPERSEDED_CODE = 'SESSION_SUPERSEDED';

function coercePositiveSessionVersion(value: unknown): number | null {
  let numeric: number;

  if (typeof value === 'bigint') {
    numeric = Number(value);
  } else if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    numeric = Number(value.trim());
  } else {
    return null;
  }

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

/**
 * Missing `sv` on tokens issued before session versioning is treated as 1.
 * A present numeric string or bigint is kept; it is not collapsed to 1.
 */
export const readAccessTokenSessionVersion = (payload: {
  sv?: unknown;
}): number => {
  if (payload.sv === undefined || payload.sv === null) {
    return 1;
  }

  return coercePositiveSessionVersion(payload.sv) ?? 0;
};

function storedSessionVersion(value: unknown): number | null {
  return coercePositiveSessionVersion(value);
}

/**
 * Rejects access tokens whose session version no longer matches the user row.
 */
export async function assertCurrentSession(
  userId: string,
  sessionVersion: number,
): Promise<void> {
  let parsedId: bigint;

  try {
    parsedId = BigInt(userId);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = await prisma.users.findUnique({
    where: { Id: parsedId },
    select: { SessionVersion: true },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const currentVersion = storedSessionVersion(user.SessionVersion);
  if (currentVersion === null || currentVersion !== sessionVersion) {
    throw new UnauthorizedError(
      'Invalid or expired token',
      SESSION_SUPERSEDED_CODE,
    );
  }
}
