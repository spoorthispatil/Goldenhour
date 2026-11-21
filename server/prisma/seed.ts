import { PrismaClient } from '@prisma/client';

/**
 * The default database starts empty on purpose. Hospitals and dispatchers
 * register in the UI, and each hospital imports its own bed, blood and medicine
 * dataset.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [users, hospitals, requests] = await Promise.all([
    prisma.user.count(),
    prisma.hospital.count(),
    prisma.emergencyRequest.count(),
  ]);

  console.log('[seed] no sample data is written');
  console.log(
    `[seed] database has ${users} users, ${hospitals} hospitals and ${requests} requests - register accounts in the UI`,
  );
}

main()
  .catch((error) => {
    console.error('[seed] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
