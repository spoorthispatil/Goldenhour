import { prisma } from '../db/prisma';

const CORE_TABLES = [
  'users',
  'hospital',
  'blood_stock',
  'medicine_stock',
  'ambulance',
  'patient',
  'emergency_request',
  'assignment',
] as const;

const LABELS: Record<string, string> = {
  users: 'Users',
  hospital: 'Hospital',
  blood_stock: 'Blood stock',
  medicine_stock: 'Medicine stock',
  ambulance: 'Ambulance',
  patient: 'Patient',
  emergency_request: 'Emergency request',
  assignment: 'Assignment',
};

export async function getDatabaseOverview() {
  const [versionRow] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
  const [sizeRow] = await prisma.$queryRaw<{ size: string; name: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
           current_database() AS name`;

  const tables = [];
  for (const name of CORE_TABLES) {
    // The identifier is taken from a fixed allow-list, never from user input.
    const [row] = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${name}"`,
    );
    tables.push({ name, label: LABELS[name] ?? name, rows: Number(row?.count ?? 0) });
  }

  // Fixed allow-list, embedded as a SQL literal (never user input).
  const tableArray =
    "ARRAY['users','hospital','blood_stock','medicine_stock','ambulance','patient','emergency_request','assignment']::text[]";

  const [{ constraints }] = await prisma.$queryRawUnsafe<{ constraints: bigint }[]>(`
    SELECT COUNT(*)::bigint AS constraints
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND rel.relname = ANY(${tableArray})`);

  const [{ indexes }] = await prisma.$queryRawUnsafe<{ indexes: bigint }[]>(`
    SELECT COUNT(*)::bigint AS indexes
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY(${tableArray})`);

  const [{ migrations }] = await prisma.$queryRaw<{ migrations: bigint }[]>`
    SELECT COUNT(*)::bigint AS migrations
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL`;

  return {
    dataSource: 'postgresql' as const,
    databaseName: sizeRow?.name ?? 'goldenhour',
    serverVersion: (versionRow?.version ?? 'PostgreSQL').split(' on ')[0] ?? 'PostgreSQL',
    sizePretty: sizeRow?.size ?? 'unknown',
    tables,
    constraintCount: Number(constraints ?? 0),
    indexCount: Number(indexes ?? 0),
    migrationCount: Number(migrations ?? 0),
  };
}
