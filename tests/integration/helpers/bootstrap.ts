/**
 * Bootstrap de Postgres desechable para tests de integración:
 * schema auth mínimo estilo Supabase + migraciones 001-007.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool, PoolClient } from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(HERE, '../../../backend/src/database/migrations');

export const MIGRATION_FILES = [
  '001_initial_schema.sql',
  '002_push_tokens.sql',
  '003_study_sessions.sql',
  '004_reminder_ownership.sql',
  '005_calendar_integrations_hardening.sql',
  '006_academic_sm2_atomic.sql',
  '007_reminder_worker.sql',
] as const;

export async function resetPublicSchema(client: PoolClient | Pool): Promise<void> {
  await client.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO PUBLIC;
  `);
}

export async function bootstrapAuthSchema(client: PoolClient | Pool): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await client.query(`CREATE SCHEMA IF NOT EXISTS auth;`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      email text UNIQUE,
      encrypted_password text,
      email_confirmed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);

  await client.query(`
    DO $$ BEGIN
      CREATE ROLE anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await client.query(`
    DO $$ BEGIN
      CREATE ROLE service_role NOLOGIN BYPASSRLS;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  await client.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
  await client.query(`GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;`);
  await client.query(`GRANT SELECT ON auth.users TO authenticated, service_role;`);
}

export async function applyMigrations(
  client: PoolClient | Pool,
  files: readonly string[] = MIGRATION_FILES
): Promise<void> {
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration failed: ${file}\n${message}`);
    }
  }

  // La migración define el modelo de permisos (RLS y GRANT por tabla).
  // El harness NO re-otorga privilegios a `authenticated`: eso anularía los
  // REVOKE deliberados (p.ej. 005 calendar_oauth_states → 401/42501).
  // Solo se garantiza service_role amplio como en Supabase.
  await client.query(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
  `);
}

export async function prepareCleanDatabase(client: PoolClient | Pool): Promise<void> {
  await resetPublicSchema(client);
  await bootstrapAuthSchema(client);
  await applyMigrations(client);
}

/** Actúa como usuario autenticado (RLS) dentro de la sesión actual. */
export async function asUser(client: PoolClient, userId: string): Promise<void> {
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
  await client.query(`SET LOCAL ROLE authenticated`);
}

export async function asServiceRole(client: PoolClient): Promise<void> {
  await client.query(`SET LOCAL ROLE service_role`);
}

export async function insertAuthUser(
  client: PoolClient | Pool,
  email = `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
     VALUES ($1, 'test-hash', now())
     RETURNING id`,
    [email]
  );
  return result.rows[0].id;
}
