import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../generated/prisma/client';
import { config } from '../../config/src/config';
import { createMariaDbConfig } from './mariadb-config';

const adapter = new PrismaMariaDb(createMariaDbConfig(config.DATABASE_URL));

/**
 * Shared Prisma client instance.
 */
export const prisma = new PrismaClient({ adapter });