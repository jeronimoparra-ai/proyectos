/**
 * Migración incremental: datos de 001 se preservan al aplicar 002-010.
 * Behaviour: applyMigrations incremental; existing stub only.
 * Instruction: MIGRACIÓN ... ACTUALIZACIÓN (001-010 sobre Postgres desechable).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import {
  applyMigrations,
  bootstrapAuthSchema,
  insertAuthUser,
  resetPublicSchema,
} from '../helpers/bootstrap';

describe('Migration Update', () => {
  const pool = getTestPool();
  let userId = '';
  let taskId = '';
  let taskTitle = '';
  let academicId = '';

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await resetPublicSchema(client);
      await bootstrapAuthSchema(client);
      await applyMigrations(client, ['001_initial_schema.sql']);
      await grantRoleMembership(client);

      userId = await insertAuthUser(client, 'migrate-update@example.com');
      taskTitle = `seed-task-${Date.now()}`;
      const task = await client.query<{ id: string }>(
        `INSERT INTO tasks (user_id, title, status, priority)
         VALUES ($1, $2, 'pending', 'medium')
         RETURNING id`,
        [userId, taskTitle]
      );
      taskId = task.rows[0].id;

      academicId = (await client.query(`INSERT INTO academic_tasks(user_id,title) VALUES($1,'Historical') RETURNING id`, [userId])).rows[0].id;
      await client.query(`INSERT INTO reviews(user_id,academic_task_id,quality,repetitions)
        VALUES($1,$2,5,1),($1,$2,1,0)`, [userId, academicId]);

      await applyMigrations(client, [
        '002_push_tokens.sql',
        '003_study_sessions.sql',
        '004_reminder_ownership.sql',
        '005_calendar_integrations_hardening.sql',
        '006_academic_sm2_atomic.sql',
        '007_reminder_worker.sql',
        '008_fix_handle_new_user.sql',
        '009_grant_table_privileges.sql',
        '010_fix_task_soft_delete_rls.sql',
        '013_backend_atomicity.sql',
      ]);
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('preserva tareas existentes tras migraciones incrementales', async () => {
    const { rows } = await pool.query<{ id: string; title: string }>(
      `SELECT id, title FROM tasks WHERE id = $1`,
      [taskId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe(taskTitle);
  });

  it('013 restores historical counts from preexisting reviews without changing the streak', async () => {
    const state = await pool.query('SELECT total_reviews,review_count FROM academic_tasks WHERE id=$1', [academicId]);
    expect(state.rows).toEqual([{ total_reviews: 2, review_count: 0 }]);
    const index = await pool.query("SELECT indexdef FROM pg_indexes WHERE indexname='idx_reminders_pending_due'");
    expect(index.rows[0].indexdef).toContain('remind_at, id');
  });

  it('crea tablas nuevas sin borrar datos previos', async () => {
    const { rows } = await pool.query<{ exists: boolean }>(
      `SELECT to_regclass('public.push_tokens') IS NOT NULL
         AND to_regclass('public.study_sessions') IS NOT NULL
         AND to_regclass('public.calendar_oauth_states') IS NOT NULL AS exists`
    );
    expect(rows[0].exists).toBe(true);

    const count = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM tasks`);
    expect(Number(count.rows[0].n)).toBeGreaterThanOrEqual(1);
  });

  it('añade columnas de worker/SM-2 sobre schema previo', async () => {
    const { rows } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'reminders' AND column_name IN ('claimed_at', 'locked_by', 'retry_count'))
           OR (table_name = 'academic_tasks' AND column_name = 'total_reviews')
           OR (table_name = 'reviews' AND column_name = 'idempotency_key')
         )
       ORDER BY column_name`
    );
    expect(rows.map((r) => r.column_name).sort()).toEqual([
      'claimed_at',
      'idempotency_key',
      'locked_by',
      'retry_count',
      'total_reviews',
    ]);
  });
});
