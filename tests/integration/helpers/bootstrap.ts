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
  // Concesión amplia ANTES de las migraciones: las migraciones definen
  // las RLS y los REVOKE específicos (p.ej. 005 → calendar_oauth_states
  // queda service_role only). Si se re-concede después, anula esos REVOKE.
  await client.query(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
  `);

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration failed: ${file}\n${message}`);
    }
  }

  // Tras aplicar migraciones, vuelve a otorgar permisos análogos a Supabase
  // (PUBLIC schema visible para authenticated, RLS decide filas), y luego
  // re-aplica los REVOKE deliberados: tablas restringidas 005.
  await client.query(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
  `);
  // Re-aplica los REVOKE deliberados de 005/007 (capacidades solo service_role).
  // Tolerante a estado intermedio: algunas migraciones aún no crearon estas
  // tablas/funciones (p.ej. applyMigrations(['001']) solo aplica 001).
  await client.query(`
    DO $$
    BEGIN
      IF to_regclass('public.calendar_integrations') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.calendar_integrations FROM PUBLIC, anon, authenticated';
      END IF;
      IF to_regclass('public.calendar_oauth_states') IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON public.calendar_oauth_states FROM PUBLIC, anon, authenticated';
      END IF;
      IF to_regprocedure('public.import_calendar_events(uuid, uuid, jsonb)') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.import_calendar_events(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated';
      END IF;
      IF to_regprocedure('public.complete_calendar_connection(uuid, text, text, jsonb)') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.complete_calendar_connection(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated';
      END IF;
      IF to_regprocedure('public.disconnect_calendar(uuid)') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.disconnect_calendar(uuid) FROM PUBLIC, anon, authenticated';
      END IF;
      IF to_regprocedure('public.claim_due_reminders(text, integer, integer)') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.claim_due_reminders(text, integer, integer) FROM PUBLIC, anon, authenticated';
      END IF;
    END $$;
  `);
}

export async function prepareCleanDatabase(client: PoolClient | Pool): Promise<void> {
  await resetPublicSchema(client);
  await bootstrapAuthSchema(client);
  await applyMigrations(client);
}

/** Actúa como usuario autenticado (RLS) dentro de la sesión actual. */
export async function asUser(client: PoolClient, userId: string): Promise<void> {
  // is_local=false => la asignación persiste mientras dure la conexión,
  // no sólo en la transacción actual (queries en autocommit se ven).
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  await client.query(`SET ROLE authenticated`);
}

export async function asServiceRole(client: PoolClient): Promise<void> {
  await client.query(`SET ROLE service_role`);
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
