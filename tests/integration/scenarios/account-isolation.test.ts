/**
 * Aislamiento entre cuentas vía RLS (auth.uid) sobre Postgres desechable.
 * Module: asUser + policies on tasks/academic_tasks/push_tokens.
 * Existing: stub account-isolation.test.ts; unit calendar RLS in google-calendar.service.test.ts.
 * Instruction: AISLAMIENTO entre cuentas (RLS/API).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import { asUser, insertAuthUser, prepareCleanDatabase } from '../helpers/bootstrap';

describe('Account Isolation (RLS)', () => {
  const pool = getTestPool();
  let userA = '';
  let userB = '';
  let taskA = '';
  let academicA = '';

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
      userA = await insertAuthUser(client, 'iso-a@example.com');
      userB = await insertAuthUser(client, 'iso-b@example.com');

      const t = await client.query<{ id: string }>(
        `INSERT INTO tasks (user_id, title) VALUES ($1, 'Task A') RETURNING id`,
        [userA]
      );
      taskA = t.rows[0].id;

      const a = await client.query<{ id: string }>(
        `INSERT INTO academic_tasks (user_id, title) VALUES ($1, 'Academic A') RETURNING id`,
        [userA]
      );
      academicA = a.rows[0].id;
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('Usuario B no lee tareas de Usuario A', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await asUser(client, userB);
      const { rows } = await client.query(`SELECT id FROM tasks WHERE id = $1`, [taskA]);
      expect(rows).toHaveLength(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('Usuario A sí lee sus propias tareas', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await asUser(client, userA);
      const { rows } = await client.query(`SELECT id FROM tasks WHERE id = $1`, [taskA]);
      expect(rows).toHaveLength(1);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('Usuario B no puede insertar tarea con user_id de A', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await asUser(client, userB);
      await expect(
        client.query(`INSERT INTO tasks (user_id, title) VALUES ($1, 'spoof')`, [userA])
      ).rejects.toThrow();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('Usuario B no lee academic_tasks de A', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await asUser(client, userB);
      const { rows } = await client.query(`SELECT id FROM academic_tasks WHERE id = $1`, [
        academicA,
      ]);
      expect(rows).toHaveLength(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('Usuario B no lee push_tokens de A', async () => {
    await pool.query(
      `INSERT INTO push_tokens (user_id, token, platform) VALUES ($1, $2, 'android')
       ON CONFLICT (token) DO NOTHING`,
      [userA, `ExponentPushToken[iso-a-${Date.now()}]`]
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await asUser(client, userB);
      const { rows } = await client.query(`SELECT id FROM push_tokens WHERE user_id = $1`, [
        userA,
      ]);
      expect(rows).toHaveLength(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
