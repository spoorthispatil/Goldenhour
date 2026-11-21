# Progress

Work log for the dispatch logic module (severity ranking, hospital readiness matching, ambulance search).

## 15 Nov 2026 – Severity ranking

- Added `priorityQueue.ts`: `priorityScore = severityWeight × 1000 + min(waitingMinutes, 999)` with deterministic tie-breaks (older `createdAt`, then request ID).
- Added `queueService.ts`, `types.ts` and the client `severity.ts` helpers.
- Added `rank-check.ts` to verify and print the ranking.

## 16 Nov 2026 – Readiness matching and assignment

- Added `readinessService.ts`: readiness /100 = blood 40 + medicine 40 + nearness 20 (25 km radius).
- Added `hospitalMatchService.ts`, `assignmentService.ts` (transactional assign and close) and `dashboardService.ts`.
- Added `readiness-check.ts` to verify the scoring.

## 20 Nov 2026 – Ambulance search

- Updated `ambulanceService.ts`: fleet registration and Haversine search over `AVAILABLE` vehicles, nearest first, with ETA.

## Status

- Ranking, readiness scoring and ambulance search implemented.
- `npm run check` runs both verification scripts.
