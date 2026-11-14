/**
 * Vitest configuration for integration tests.
 *
 * Runs tests/integration/scenarios/*.test.ts against a real Postgres instance.
 * The DB connection is controlled by TEST_DB_* env vars; defaults match the
 * GitHub Actions postgres service defined in ci.yml (port 5432, via
 * TEST_DB_PORT=5432) and the docker-compose.yml for local runs (port 5433 by
 * default via TEST_DB_PORT=5433 — see docker-compose.yml).
 *
 * Usage (CI):
 *   TEST_DB_PORT=5432 npx vitest run --config tests/integration/vitest.config.mts
 *
 * Usage (local, docker-compose):
 *   docker-compose -f tests/integration/docker-compose.yml up -d
 *   TEST_DB_PORT=5432 npx vitest run --config tests/integration/vitest.config.mts
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run each file in its own worker to avoid cross-test pool leaks.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    include: ['tests/integration/scenarios/**/*.test.ts'],
    globalSetup: ['tests/integration/setup.ts'],
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
