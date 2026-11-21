/**
 * Integración API/DB a nivel de contrato SQL/RPC (capa que usa la API).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import { insertAuthUser, prepareCleanDatabase, asUser } from '../helpers/bootstrap';

describe('API/DB Integration (SQL contract)', () => {
  const pool = getTestPool();
  let userId = '';

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
      userId = await insertAuthUser(client, 'api-db@example.com');
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('CRUD tasks: insert/select/update/soft-delete', async () => {
    const created = await pool.query<{ id: string }>(
      `INSERT INTO tasks (user_id, title, status) VALUES ($1, 'CRUD', 'pending') RETURNING id`,
      [userId]
    );
    const id = created.rows[0].id;

    const listed = await pool.query(`SELECT id FROM tasks WHERE user_id = $1 AND deleted_at IS NULL`, [
      userId,
    ]);
    expect(listed.rowCount).toBeGreaterThanOrEqual(1);

    await pool.query(`UPDATE tasks SET title = 'CRUD-updated' WHERE id = $1`, [id]);
    const updated = await pool.query<{ title: string; updated_at: Date; created_at: Date }>(
      `SELECT title, updated_at, created_at FROM tasks WHERE id = $1`,
      [id]
    );
    expect(updated.rows[0].title).toBe('CRUD-updated');
    expect(updated.rows[0].updated_at.getTime()).toBeGreaterThanOrEqual(
      updated.rows[0].created_at.getTime()
    );

    await pool.query(`UPDATE tasks SET deleted_at = now() WHERE id = $1`, [id]);
    const soft = await pool.query(`SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL`, [id]);
    expect(soft.rowCount).toBe(0);
  });

  it('RPC create_academic_task_atomic crea task + materials + topics', async () => {
    const client = await pool.connect();
    try {
      await asUser(client, userId);
    const { rows } = await client.query<{ task_id: string }>(
      `SELECT task_id FROM create_academic_task_atomic(
         $1, 'Atomic Task', 'Math', 'Body',
         '[{"type":"text","content":"notes"}]'::jsonb,
         '[{"name":"Algebra","description":"ch1"}]'::jsonb
       )`,
      [userId]
    );
    const taskId = rows[0].task_id;
    const mats = await client.query(`SELECT id FROM study_materials WHERE academic_task_id = $1`, [
      taskId,
    ]);
    const topics = await client.query(`SELECT id FROM topics WHERE academic_task_id = $1`, [taskId]);
    expect(mats.rowCount).toBe(1);
    expect(topics.rowCount).toBe(1);
    } finally { await client.query('RESET ROLE'); client.release(); }
  });

  it('CHECK constraints rechazan status/priority inválidos', async () => {
    await expect(
      pool.query(`INSERT INTO tasks (user_id, title, status) VALUES ($1, 'bad', 'nope')`, [userId])
    ).rejects.toThrow(/check/i);
    await expect(
      pool.query(
        `INSERT INTO tasks (user_id, title, priority) VALUES ($1, 'bad', 'extreme')`,
        [userId]
      )
    ).rejects.toThrow(/check/i);
  });

  it('FK reminder ownership (004) bloquea task_id de otro usuario', async () => {
    const other = await insertAuthUser(pool, 'api-db-other@example.com');
    const otherTask = await pool.query<{ id: string }>(
      `INSERT INTO tasks (user_id, title) VALUES ($1, 'Other') RETURNING id`,
      [other]
    );
    await expect(
      pool.query(
        `INSERT INTO reminders (user_id, task_id, remind_at, type)
         VALUES ($1, $2, now() + interval '1 hour', 'notification')`,
        [userId, otherTask.rows[0].id]
      )
    ).rejects.toThrow();
  });
});
