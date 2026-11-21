import { TEST_DATABASE_URL } from './test-database';

// Runs before each test file imports application modules, so the Prisma client
// and env.ts both see the throwaway test database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_SECRET = 'goldenhour-test-only-secret';
