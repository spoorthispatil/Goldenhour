# GoldenHour – Dispatch Logic

Severity ranking, hospital readiness scoring and ambulance matching for an emergency dispatch system (Hubballi, Karnataka).

## How it works

**Severity ranking** (`server/src/services/priorityQueue.ts`)

```
priorityScore = severityWeight × 1000 + min(waitingMinutes, 999)
```

Weights: CRITICAL 4, HIGH 3, MEDIUM 2, LOW 1. The multiplier (1000) is larger than the waiting cap (999), so a higher severity can never be overtaken by a longer wait. Ties fall back to the older `createdAt`, then request ID, so ordering is deterministic.

**Distance and ETA** (`server/src/utils/geo.ts`)

Haversine straight-line distance; ETA assumes 35 km/h average speed with a 3-minute minimum. Ambulance search considers only `AVAILABLE` vehicles, nearest first.

**Hospital readiness** (`server/src/services/readinessService.ts`)

```
readiness /100 = blood 40 + medicine 40 + nearness 20
nearness       = 20 × max(0, 1 − distanceKm / 25)
```

Only hospitals with a free bed are scored. A component the emergency doesn't require is awarded in full.

**Assignment and closure** (`server/src/services/assignmentService.ts`)

Dispatch and case closure each run in one transaction, locking rows in a fixed order (request → ambulance → hospital) to avoid deadlocks.

## Structure

```
client/src/lib/severity.ts            severity styles and time formatting
server/src/types.ts                   shared types and severity weights
server/src/utils/geo.ts               Haversine distance, ETA
server/src/utils/areas.ts             nearest-area labels
server/src/services/priorityQueue.ts  ranking algorithm
server/src/services/queueService.ts   dispatcher queue
server/src/services/readinessService.ts   hospital scoring
server/src/services/hospitalMatchService.ts   hospital matching
server/src/services/ambulanceService.ts   fleet registration and search
server/src/services/assignmentService.ts  transactional assign / close
server/src/services/dashboardService.ts   dashboard aggregates
server/scripts/                       standalone verification scripts
```

## Run the checks

```bash
npm install
npm run check
```

`rank-check` and `readiness-check` exercise the pure ranking and scoring logic and need no database.

## Note

The database-backed services (`ambulanceService`, `assignmentService`, `dashboardService`, `hospitalMatchService`, `queueService`) import a Prisma client at `server/src/db/prisma.ts`, a validation module at `server/src/validation/ambulanceSearch.ts`, and `client/src/lib/types.ts`. These belong to other parts of the GoldenHour system and are not part of this repository, so only the ranking and scoring logic and the check scripts run on their own.

See [PROGRESS.md](PROGRESS.md) for the work log.
