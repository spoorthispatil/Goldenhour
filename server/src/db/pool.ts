import { Pool } from 'pg';
import { env } from '../config/env';

let pool: Pool | null = null;

/**
 * PostgreSQL access goes through this single pool.
 * Tables and constraints are created and migrated with Prisma; this pool is
 * only used for connectivity checks and raw SQL.
 */
export function getPool(): Pool | null {
  if (!env.databaseUrl) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
  });

  // Never let a background connection error crash the API process.
  pool.on('error', (error) => {
    console.error('[db] idle client error:', error.message);
  });

  return pool;
}

export interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
  message: string;
}

export async function checkDatabase(): Promise<DatabaseStatus> {
  if (!env.databaseUrl) {
    return {
      configured: false,
      connected: false,
      latencyMs: null,
      message:
        'DATABASE_URL is not set. Create .env from .env.example to enable PostgreSQL.',
    };
  }

  const client = getPool();
  if (!client) {
    return {
      configured: false,
      connected: false,
      latencyMs: null,
      message: 'Database pool could not be created.',
    };
  }

  const startedAt = Date.now();
  try {
    const result = await client.query<{ version: string }>('SELECT version()');
    return {
      configured: true,
      connected: true,
      latencyMs: Date.now() - startedAt,
      message: result.rows[0]?.version ?? 'PostgreSQL reachable.',
    };
  } catch (error) {
    const detail =
      error instanceof Error
        ? [error.message, (error as NodeJS.ErrnoException).code]
            .filter(Boolean)
            .join(' ') || error.name
        : 'Unknown database error';
    return {
      configured: true,
      connected: false,
      latencyMs: null,
      message: `PostgreSQL not reachable (${detail}). Start the server or update DATABASE_URL.`,
    };
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
