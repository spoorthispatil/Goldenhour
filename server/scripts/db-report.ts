/**
 * Prints the live PostgreSQL structure and a few sample queries.
 * Run with `npm run db:report`.
 */
import { Client } from 'pg';
import { env } from '../src/config/env';

const CORE_TABLES = [
  'users',
  'hospital',
  'blood_stock',
  'medicine_stock',
  'ambulance',
  'patient',
  'emergency_request',
  'assignment',
];

const client = new Client({ connectionString: env.databaseUrl });

function heading(title: string): void {
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);
}

async function main(): Promise<void> {
  await client.connect();

  const version = await client.query<{ version: string }>('SELECT version()');
  const size = await client.query<{ size: string; name: string }>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
            current_database() AS name`,
  );
  heading('1. SERVER');
  console.log(version.rows[0]?.version);
  console.log(`database: ${size.rows[0]?.name}  size: ${size.rows[0]?.size}`);

  heading('2. CORE TABLES AND ROW COUNTS');
  const counts = await client.query<{ table: string }>(`
    SELECT c.relname AS table
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`);

  // pg clients are not safe for concurrent queries, so counts run in sequence.
  const liveCounts: { table: string; rows: number }[] = [];
  for (const row of counts.rows) {
    if (!CORE_TABLES.includes(row.table)) continue;
    const exact = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${row.table}"`,
    );
    liveCounts.push({ table: row.table, rows: Number(exact.rows[0]?.count ?? 0) });
  }
  console.table(liveCounts);
  const missing = CORE_TABLES.filter(
    (table) => !liveCounts.some((row) => row.table === table),
  );
  console.log(
    missing.length === 0
      ? `All 8 core tables exist.`
      : `MISSING TABLES: ${missing.join(', ')}`,
  );

  heading('3. COLUMNS');
  const columns = await client.query<{
    table: string;
    column: string;
    type: string;
    nullable: string;
    default: string | null;
  }>(`
    SELECT table_name AS table, column_name AS column, data_type AS type,
           is_nullable AS nullable, column_default AS default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position`, [CORE_TABLES]);
  let currentTable = '';
  for (const row of columns.rows) {
    if (row.table !== currentTable) {
      console.log(`\n${row.table}`);
      currentTable = row.table;
    }
    const nullability = row.nullable === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`  ${row.column.padEnd(22)} ${row.type.padEnd(26)} ${nullability}`);
  }

  heading('4. CONSTRAINTS (primary, foreign, unique, check)');
  const constraints = await client.query<{
    table: string;
    name: string;
    type: string;
    definition: string;
  }>(`
    SELECT rel.relname AS table, con.conname AS name,
           CASE con.contype
             WHEN 'p' THEN 'PRIMARY KEY'
             WHEN 'f' THEN 'FOREIGN KEY'
             WHEN 'u' THEN 'UNIQUE'
             WHEN 'c' THEN 'CHECK'
             ELSE con.contype::text
           END AS type,
           pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND rel.relname = ANY($1::text[])
    ORDER BY rel.relname, con.contype DESC, con.conname`, [CORE_TABLES]);
  for (const row of constraints.rows) {
    console.log(`${row.table.padEnd(20)} ${row.type.padEnd(12)} ${row.name}`);
    console.log(`  ${row.definition}`);
  }

  heading('5. INDEXES (including the partial unique guard against double booking)');
  const indexes = await client.query<{ table: string; name: string; definition: string }>(`
    SELECT tablename AS table, indexname AS name, indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY($1::text[])
    ORDER BY tablename, indexname`, [CORE_TABLES]);
  for (const row of indexes.rows) {
    console.log(`${row.table.padEnd(20)} ${row.name}`);
    console.log(`  ${row.definition}`);
  }

  heading('6. SAMPLE QUERY - ranked open queue (severity, then waiting time)');
  const queue = await client.query(`
    SELECT r.request_id, p.name AS patient, r.severity, r.status,
           ROUND(EXTRACT(EPOCH FROM (now() - r.created_at)) / 60)::int AS waiting_min,
           r.blood_group_needed, r.medicine_needed
    FROM emergency_request r
    JOIN patient p ON p.patient_id = r.patient_id
    WHERE r.status <> 'CLOSED'
    ORDER BY r.severity ASC, r.created_at ASC`);
  console.table(queue.rows);

  heading('7. SAMPLE QUERY - hospital readiness inputs');
  const readiness = await client.query(`
    SELECT h.hospital_id, h.name, h.free_beds, h.total_beds,
           COALESCE(SUM(b.units), 0) AS blood_units,
           (SELECT units FROM blood_stock WHERE hospital_id = h.hospital_id AND blood_group = 'O+') AS o_plus,
           (SELECT units FROM medicine_stock WHERE hospital_id = h.hospital_id AND medicine = 'Adrenaline') AS adrenaline
    FROM hospital h
    LEFT JOIN blood_stock b ON b.hospital_id = h.hospital_id
    GROUP BY h.hospital_id
    ORDER BY h.hospital_id`);
  console.table(readiness.rows);

  heading('8. SAMPLE QUERY - assignments joined across four tables');
  const assignments = await client.query(`
    SELECT a.assignment_id, a.request_id, p.name AS patient, r.severity,
           amb.reg_no AS ambulance, h.name AS hospital,
           a.distance_km, a.readiness_score, a.partial_flag,
           a.assigned_at, a.closed_at
    FROM assignment a
    JOIN emergency_request r ON r.request_id = a.request_id
    JOIN patient p ON p.patient_id = r.patient_id
    JOIN ambulance amb ON amb.ambulance_id = a.ambulance_id
    JOIN hospital h ON h.hospital_id = a.hospital_id
    ORDER BY a.assigned_at DESC`);
  console.table(assignments.rows);

  heading('9. LIVE CONSTRAINT CHECK - a dispatcher with a hospital is rejected');
  try {
    await client.query(
      `INSERT INTO users (user_id, username, password_hash, role, hospital_id)
       VALUES ('USR-BAD', 'bad.dispatcher', 'x', 'DISPATCHER', 'HOSP-01')`,
    );
    console.log('UNEXPECTED: invalid row was accepted');
  } catch (error) {
    console.log(`Rejected as expected: ${(error as Error).message}`);
  }

  heading('10. LIVE CONSTRAINT CHECK - a 9-digit contact is rejected');
  try {
    await client.query(
      `INSERT INTO patient (patient_id, name, age, contact)
       VALUES ('PAT-BAD', 'Test Patient', 30, '984501234')`,
    );
    console.log('UNEXPECTED: invalid row was accepted');
  } catch (error) {
    console.log(`Rejected as expected: ${(error as Error).message}`);
  }

  heading('11. LIVE CONSTRAINT CHECK - one ambulance cannot hold two open assignments');
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO assignment
         (assignment_id, request_id, ambulance_id, hospital_id, distance_km,
          readiness_score, partial_flag, reason)
       VALUES ('ASG-CONFLICT', 'REQ-2026-0001', 'AMB-01', 'HOSP-01', 2.20, 90, false,
               'double booking attempt')`,
    );
    console.log('UNEXPECTED: the database allowed a second open assignment');
  } catch (error) {
    console.log(`Rejected as expected: ${(error as Error).message}`);
  } finally {
    await client.query('ROLLBACK');
  }

  heading('12. LIVE CONSTRAINT CHECK - free beds above total beds is rejected');
  try {
    await client.query(
      `UPDATE hospital SET free_beds = total_beds + 1 WHERE hospital_id = 'HOSP-01'`,
    );
    console.log('UNEXPECTED: invalid bed counts were accepted');
  } catch (error) {
    console.log(`Rejected as expected: ${(error as Error).message}`);
  }

  await client.end();
}

main().catch(async (error) => {
  console.error('[db:report]', (error as Error).message);
  await client.end().catch(() => undefined);
  process.exit(1);
});
