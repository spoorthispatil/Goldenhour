import path from 'node:path';
import dotenv from 'dotenv';

// The .env file lives at the repository root, next to client/ and server/.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Allow a server-local override during development.
dotenv.config();

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}

function readSessionHours(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) return 8;
  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const configuredSecret = process.env.JWT_SECRET?.trim() ?? '';
if (!configuredSecret && isProduction) {
  throw new Error('JWT_SECRET must be set in production.');
}

export const env = {
  nodeEnv,
  isProduction,
  port: readPort(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL?.trim() ?? '',
  jwtSecret: configuredSecret || 'goldenhour-development-only-secret',
  cookieName: process.env.SESSION_COOKIE_NAME?.trim() || 'gh_session',
  sessionHours: readSessionHours(process.env.SESSION_HOURS),
  serviceName: 'goldenhour-api',
  version: '0.14.0',
} as const;

export type Env = typeof env;
