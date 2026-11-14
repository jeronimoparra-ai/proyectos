/**
 * Helpers de base de datos para tests de integración
 * Proporciona utilidades para configurar y limpiar estado de BD entre tests
 */

import { Pool, PoolClient, QueryResult } from 'pg';

export interface TestDatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export const defaultTestDbConfig: TestDatabaseConfig = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: parseInt(process.env.TEST_DB_PORT ?? '5432', 10),
  database: process.env.TEST_DB_NAME ?? 'productivity_test',
  user: process.env.TEST_DB_USER ?? 'test_user',
  password: process.env.TEST_DB_PASSWORD ?? 'test_password',
};

let pool: Pool | null = null;

/**
 * Obtiene o crea el pool de conexiones para tests
 */
export function getTestPool(config: TestDatabaseConfig = defaultTestDbConfig): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[Test DB] Unexpected error on idle client', err);
    });
  }
  return pool;
}

/**
 * Ejecuta una query en la base de datos de test
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
  config?: TestDatabaseConfig
): Promise<QueryResult<T>> {
  const client = getTestPool(config);
  return client.query<T>(text, params);
}

/**
 * Obtiene un cliente para transacciones
 */
export async function getTestClient(config: TestDatabaseConfig = defaultTestDbConfig): Promise<PoolClient> {
  const client = getTestPool(config);
  return client.connect();
}

/**
 * Ejecuta una transacción con rollback automático (útil para tests)
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<T> {
  const client = await getTestClient(config);
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('ROLLBACK'); // Siempre rollback en tests para aislamiento
    return result;
  } finally {
    client.release();
  }
}

/**
 * Limpia todas las tablas de datos de test (mantiene schema)
 * Útil en setup/teardown de suites de tests
 */
export async function truncateAllTables(config: TestDatabaseConfig = defaultTestDbConfig): Promise<void> {
  const tables = [
    'study_sessions',
    'push_tokens',
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
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Inserta un usuario de prueba y devuelve su ID
 */
export async function createTestUser(
  email: string = `test-${Date.now()}@example.com`,
  config: TestDatabaseConfig = defaultTestDbConfig
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
     VALUES ($1, '$2a$10$dummyhash', NOW(), NOW(), NOW())
     RETURNING id`,
    [email],
    config
  );
  return result.rows[0].id;
}

/**
 * Inserta una tarea académica de prueba
 */
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

/**
 * Inserta una review de prueba
 */
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

/**
 * Cierra el pool de conexiones (llamar en teardown global)
 */
export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}