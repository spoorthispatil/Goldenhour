import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { ADMIN_DATABASE_URL, TEST_DATABASE_URL } from './test-database';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = (name: string): string =>
  path.resolve(serverRoot, '..', 'node_modules', '.bin', name);

/**
 * Creates a clean `goldenhour_test` database and applies every migration.
 * Everything runs locally; no external service is used.
 */
export async function setup(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  try {
    await admin.query('DROP DATABASE IF EXISTS goldenhour_test WITH (FORCE)');
    await admin.query('CREATE DATABASE goldenhour_test');
  } finally {
    await admin.end();
  }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
  };

  if (!existsSync(bin('prisma')) || !existsSync(bin('tsx'))) {
    throw new Error('Local prisma/tsx binaries are missing; run npm install first.');
  }

  execFileSync(bin('prisma'), ['migrate', 'deploy'], {
    cwd: serverRoot,
    env,
    stdio: 'pipe',
  });

  // No seed: the API tests register their own hospital, dispatcher and fleet.
  console.log('[tests] goldenhour_test migrated (empty)');
}
