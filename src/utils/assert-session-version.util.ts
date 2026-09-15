import { prisma } from '../../libs/db/src/prisma';
import { UnauthorizedError } from '../errors/app-error';

export const readAccessTokenSessionVersion = (payload: {
  sv?: unknown;
}): number => {
  return typeof payload.sv === 'number' &&
    Number.isInteger(payload.sv) &&
    payload.sv > 0
    ? payload.sv
    : 1;
};

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

  if (!user || user.SessionVersion !== sessionVersion) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
