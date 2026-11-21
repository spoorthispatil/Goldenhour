#!/usr/bin/env node
/**
 * GoldenHour local PostgreSQL control script.
 *
 * Uses the PostgreSQL server binaries shipped with `embedded-postgres` so the
 * project can run a real PostgreSQL instance without Docker or root access.
 * On a normal machine with PostgreSQL installed you can ignore this script and
 * point DATABASE_URL at your own server.
 *
 * Usage: node scripts/db.cjs <init|start|stop|status|reset>
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, '.pgdata');
const LOG_FILE = path.join(DATA_DIR, 'server.log');
const PORT = process.env.PGHOSTPORT || '5432';
const DB_USER = 'goldenhour';
const DB_NAME = 'goldenhour';

function packageRootOf(name) {
  let dir = path.dirname(require.resolve(name));
  for (let depth = 0; depth < 4; depth += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(require.resolve(name));
}

function binaryDir() {
  const packages = [
    '@embedded-postgres/linux-x64',
    '@embedded-postgres/linux-arm64',
    '@embedded-postgres/darwin-x64',
    '@embedded-postgres/darwin-arm64',
  ];
  for (const name of packages) {
    try {
      return path.join(packageRootOf(name), 'native', 'bin');
    } catch {
      /* try the next platform package */
    }
  }
  throw new Error(
    'No local PostgreSQL binaries found. Install PostgreSQL and set DATABASE_URL, ' +
      'or run `npm install -w server embedded-postgres`.',
  );
}

const bin = (name) => path.join(binaryDir(), name);

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

async function ensureDatabase() {
  const { Client } = require('pg');
  const client = new Client({
    host: '127.0.0.1',
    port: Number(PORT),
    user: DB_USER,
    database: 'postgres',
  });
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    DB_NAME,
  ]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`[db] created database ${DB_NAME}`);
  } else {
    console.log(`[db] database ${DB_NAME} already exists`);
  }
  await client.end();
}

async function main() {
  const action = process.argv[2] ?? 'status';

  if (action === 'init') {
    if (fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
      console.log(`[db] cluster already initialised at ${DATA_DIR}`);
    } else {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      run(bin('initdb'), [
        '-D',
        DATA_DIR,
        '-U',
        DB_USER,
        '-A',
        'trust',
        '-E',
        'UTF8',
        '--locale=C',
      ]);
      console.log('[db] cluster initialised');
    }
    return;
  }

  if (action === 'start') {
    if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
      throw new Error('Run `npm run db:init` first.');
    }
    try {
      run(bin('pg_ctl'), ['-D', DATA_DIR, 'status'], { stdio: 'ignore' });
      console.log('[db] already running');
    } catch {
      run(bin('pg_ctl'), [
        '-D',
        DATA_DIR,
        '-l',
        LOG_FILE,
        '-o',
        `-p ${PORT} -k /tmp -c listen_addresses=127.0.0.1`,
        '-w',
        'start',
      ]);
    }
    await ensureDatabase();
    console.log(`[db] PostgreSQL ready on 127.0.0.1:${PORT}/${DB_NAME}`);
    return;
  }

  if (action === 'stop') {
    run(bin('pg_ctl'), ['-D', DATA_DIR, '-m', 'fast', 'stop']);
    return;
  }

  if (action === 'status') {
    run(bin('pg_ctl'), ['-D', DATA_DIR, 'status']);
    return;
  }

  if (action === 'reset') {
    try {
      run(bin('pg_ctl'), ['-D', DATA_DIR, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
    } catch {
      /* not running */
    }
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    console.log('[db] cluster removed - run `npm run db:setup` to recreate');
    return;
  }

  throw new Error(`Unknown action "${action}". Use init|start|stop|status|reset.`);
}

main().catch((error) => {
  console.error(`[db] ${error.message}`);
  process.exit(1);
});
