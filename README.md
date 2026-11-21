# GoldenHour – Testing & Validation

Automated test suite, TypeScript and build configuration for GoldenHour, a severity ranking and hospital readiness matching system for emergency ambulance response.

## Test suite

**67 automated tests**, run with Vitest and Supertest against an isolated PostgreSQL database.

| Suite | Tests | Covers |
| --- | ---: | --- |
| `server/tests/api.test.ts` | 30 | Registration, role guards, dataset import and stock updates, fleet, patient portal, pre-booking lifecycle, donation campaigns, ranking, hospital matching, assignment and closure, patient-raised calls |
| `server/tests/validation.test.ts` | 16 | Request IDs and input validation for emergency intake, ambulance search, hospital match, assignment and hospital resources |
| `server/tests/priorityQueue.test.ts` | 7 | Severity scoring and ordering |
| `server/tests/readiness.test.ts` | 7 | Nearness curve and hospital readiness score |
| `server/tests/geo.test.ts` | 5 | Haversine distance and ETA |
| `client/tests/severity.test.ts` | 2 | Client severity constants and formatting |

### Test database

`server/tests/global-setup.ts` drops and recreates a `goldenhour_test` database and applies every migration, so each run starts empty. The API suite registers its own hospitals, dispatcher, patients, dataset and fleet. The development database is never touched.

| Variable | Default |
| --- | --- |
| `TEST_DATABASE_URL` | `postgresql://goldenhour:goldenhour@localhost:5432/goldenhour_test` |
| `TEST_ADMIN_DATABASE_URL` | `postgresql://goldenhour:goldenhour@localhost:5432/postgres` |

## Running the tests

PostgreSQL must be running and reachable with the credentials above.

```bash
npm install
cp .env.example .env     # set JWT_SECRET
npm test
```

## Structure

```
server/tests/                 API, validation, ranking, readiness and geo tests
server/tests/global-setup.ts  creates and migrates the test database
server/tests/setup-env.ts     points the app at the test database
client/tests/                 client unit tests
server/vitest.config.ts       server test configuration
client/vitest.config.ts       client test configuration
*/tsconfig*.json              TypeScript project configuration
package.json                  root workspace scripts
```

## Note

The tests import application code that lives in other parts of GoldenHour and is not included here: `server/src/app.ts`, `server/src/types.ts`, `server/src/utils/geo.ts`, the ranking and readiness services, `server/src/validation/*` and `client/src/lib/severity.ts`. They will not run on their own.

See [PROGRESS.md](PROGRESS.md) for the work log.
