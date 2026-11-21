import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { goldenHourPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.goldenHourPrisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.goldenHourPrisma = prisma;
}
