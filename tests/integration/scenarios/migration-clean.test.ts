/**
 * Migración limpia: 001-010 sobre Postgres desechable vacío.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import { MIGRATION_FILES, prepareCleanDatabase } from '../helpers/bootstrap';

describe('Migration Clean', () => {
  const pool = getTestPool();

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('aplica las 11 migraciones sin error en BD vacía', () => {
    expect(MIGRATION_FILES).toHaveLength(11);
  });

  it('crea tablas core esperadas', async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [[
        'tasks',
        'events',
        'reminders',
        'academic_tasks',
        'reviews',
        'push_tokens',
        'study_sessions',
        'calendar_integrations',
        'calendar_oauth_states',
      ]]
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      'academic_tasks',
      'calendar_integrations',
      'calendar_oauth_states',
      'events',
      'push_tokens',
      'reminders',
      'reviews',
      'study_sessions',
      'tasks',
    ]);
  });

  it('habilita RLS en tablas de usuario', async () => {
    const { rows } = await pool.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])`,
      [['tasks', 'push_tokens', 'study_sessions', 'academic_tasks', 'reviews']]
    );
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });

  it('expone RPCs de integridad (review + claim reminders)', async () => {
    const { rows } = await pool.query<{ proname: string }>(
      `SELECT proname FROM pg_proc
       WHERE pronamespace = 'public'::regnamespace
         AND proname = ANY($1::text[])
       ORDER BY proname`,
      [['claim_due_reminders', 'create_academic_task_atomic', 'record_review_atomic']]
    );
    expect(rows.map((r) => r.proname)).toEqual([
      'claim_due_reminders',
      'create_academic_task_atomic',
      'record_review_atomic',
    ]);
  });
});
