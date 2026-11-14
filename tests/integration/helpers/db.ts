/**
 * Helpers de base de datos para tests de integración.
 * Pool pg + utilidades de truncado/usuarios para escenarios T6b.
 */

import { Pool, type PoolClient, type QueryResult } from 'pg';

export interface TestDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const defaultTestDbConfig: TestDatabaseConfig = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: parseInt(process.env.TEST_DB_PORT ?? '5433', 10),
  database: process.env.TEST_DB_NAME ?? 'productivity_test',
  user: process.env.TEST_DB_USER ?? 'test_user',
  password: process.env.TEST_DB_PASSWORD ?? 'test_password',
};

let pool: Pool | null = null;

export function getTestPool(config: TestDatabaseConfig = defaultTestDbConfig): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => {
      console.error('[Test DB] Unexpected error on idle client', err.message);
    });
  }
  return pool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
  config?: TestDatabaseConfig
): Promise<QueryResult<T>> {
  return getTestPool(config).query<T>(text, params);
}

export async function getTestClient(
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<PoolClient> {
  return getTestPool(config).connect();
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<T> {
  const client = await getTestClient(config);
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('ROLLBACK');
    return result;
  } finally {
    client.release();
  }
}

export async function truncateAllTables(
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<void> {
  const tables = [
    'study_sessions',
    'push_tokens',
    'calendar_oauth_states',
    'calendar_integrations',
    'ai_interactions',
    'notifications',
    'user_preferences',
    'reviews',
    'topics',
    'study_materials',
    'academic_tasks',
    'reminders',
    'events',
    'subtasks',
    'task_tags',
    'tasks',
    'tags',
    'categories',
  ];

  const client = await getTestClient(config);
  try {
    await client.query('BEGIN');
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE IF EXISTS ${table} RESTART IDENTITY CASCADE`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createTestUser(
  email: string = `test-${Date.now()}@example.com`,
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
     VALUES ($1, 'test-hash', NOW(), NOW(), NOW())
     RETURNING id`,
    [email],
    config
  );
  return result.rows[0].id;
}

export async function createTestAcademicTask(
  userId: string,
  overrides: Partial<{
    title: string;
    subject: string;
    content: string;
    next_review_at: string;
  }> = {},
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO academic_tasks (user_id, title, subject, content, next_review_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id`,
    [
      userId,
      overrides.title ?? 'Test Academic Task',
      overrides.subject ?? 'Test Subject',
      overrides.content ?? 'Test content',
      overrides.next_review_at ?? new Date().toISOString(),
    ],
    config
  );
  return result.rows[0].id;
}

export async function createTestReview(
  userId: string,
  academicTaskId: string,
  overrides: Partial<{
    quality: number;
    difficulty: number;
    time_spent_seconds: number;
  }> = {},
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO reviews (user_id, academic_task_id, quality, difficulty, time_spent_seconds, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id`,
    [
      userId,
      academicTaskId,
      overrides.quality ?? 4,
      overrides.difficulty ?? 0.5,
      overrides.time_spent_seconds ?? 300,
    ],
    config
  );
  return result.rows[0].id;
}

export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Concede membership para SET ROLE authenticated/service_role desde el usuario de test. */
export async function grantRoleMembership(client: PoolClient | Pool): Promise<void> {
  const who = await client.query<{ current_user: string }>('SELECT current_user');
  const user = who.rows[0].current_user;
  await client.query(`GRANT authenticated TO "${user}"`);
  await client.query(`GRANT service_role TO "${user}"`);
  await client.query(`GRANT anon TO "${user}"`);
}
