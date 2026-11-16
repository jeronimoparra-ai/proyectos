/**
 * Vitest configuration for integration tests (run from backend/ directory).
 *
 * Tests live in ../tests/integration/scenarios/. The helpers connect to a real
 * Postgres instance controlled by TEST_DB_* env vars.
 *
 * CI usage (GitHub Actions, postgres service on port 5432):
 *   cd backend
 *   TEST_DB_PORT=5432 npx vitest run --config vitest.integration.config.mts
 *
 * Local usage (docker-compose):
 *   docker-compose -f tests/integration/docker-compose.yml up -d
 *   cd backend
 *   TEST_DB_PORT=5432 npx vitest run --config vitest.integration.config.mts
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run each file in its own forked process to avoid cross-test pool leaks.
    pool: 'forks',
    // Paths relative to the backend/ directory (where this config lives).
    include: ['../tests/integration/scenarios/**/*.test.ts'],
    globalSetup: ['../tests/integration/setup.ts'],
    // Individual scenarios that touch Postgres need enough time for schema setup.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Run scenarios sequentially — they share a single Postgres instance and
    // each scenario wipes+recreates the schema in beforeAll.
    sequence: {
      concurrent: false,
    },
    reporters: ['verbose'],
  },
});
