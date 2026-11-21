# GoldenHour – Data & Integrity

PostgreSQL schema, migrations and data-access services for an emergency dispatch system. Integrity is enforced in the database itself, not only in the application forms.

## Design

- **11 tables** (8 core + `prebooking`, `campaign`, `campaign_read`), defined in `server/prisma/schema.prisma` and built up through 5 migrations.
- **Constraints in the database:** primary and foreign keys, `UNIQUE`, `NOT NULL`, `CHECK` rules, and indexes including a partial index for the open request queue.
- **Role/link rule on `users`:** a `PATIENT` needs a `patient_id` and no `hospital_id`; staff roles are the reverse.
- **One open assignment per ambulance:** a partial unique index prevents an ambulance holding two open assignments.
- **Transactions:**
  - patient + emergency request are written together
  - hospital + first staff account are created together
  - a hospital dataset import replaces stock in one transaction
  - confirming a pre-booking reserves a bed; cancelling returns it
- **Request IDs** (`REQ-YYYY-NNNN`) are generated under a Postgres advisory lock, so two dispatchers never receive the same ID.

## Structure

```
server/prisma/schema.prisma        data model
server/prisma/migrations/          5 migrations + migration_lock.toml
server/prisma/seed.ts              empty-system seed (no sample data)
server/scripts/db.cjs              local PostgreSQL cluster control (init/start/stop/status/reset)
server/scripts/db-report.ts        prints live structure, constraints and sample queries
server/src/db/pool.ts, prisma.ts   connection pool and Prisma client
server/src/services/
  campaignService.ts               campaigns and read receipts
  databaseService.ts               database status
  emergencyService.ts              emergency requests
  hospitalResourcesService.ts      beds, blood, medicine, dataset import
  patientService.ts                patient portal data
  prebookingService.ts             pre-booking lifecycle
  registrationService.ts           hospital + staff registration
```

## Note

This branch contains only the data layer. It imports modules that live in other parts of GoldenHour and are not included here: `server/src/config/env.ts`, `server/src/validation/*`, and the ranking and geo helpers (`dashboardService`, `priorityQueue`, `utils/geo`). It will not run on its own.

See [PROGRESS.md](PROGRESS.md) for the work log.
