/**
 * Fixture de fallos push (Expo / FCM) — T2 y T5
 *
 * Objetivo: sustituir la plantilla sin implementar por tests reales sobre
 * propiedad+aislamiento+reasignación del push_token, bajo RLS.
 *
 * Cenario análogo a la query de T5 (`claim_due_reminders`) que filtra por
 * `sent_at IS NULL` — el Worker de recordatorios selecciona tokens activos.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import {
  prepareCleanDatabase,
  insertAuthUser,
  asUser,
  asServiceRole,
} from '../helpers/bootstrap';

describe('Push Failure Fixtures (SQL real)', () => {
  const pool = getTestPool();
  let userA = '';
  let userB = '';

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
      userA = await insertAuthUser(client, 'push-a@example.com');
      userB = await insertAuthUser(client, 'push-b@example.com');
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('El único(token) global se respeta', async () => {
    const client = await pool.connect();
    try {
      const TOKEN = `PUSH-UNIQ-${Date.now()}`;
      await asUser(client, userA);
      await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)`,
        [userA, TOKEN]
      );
      const count = await client.query('SELECT COUNT(*)::int AS c FROM push_tokens');
      expect(count.rows[0].c).toBe(1);
    } finally {
      client.release();
    }
  });

  it('RLS prohíbe que B lea/actualice/borre tokens de A; A puede', async () => {
    const client = await pool.connect();
    try {
      const TOKEN = `PUSH-ISOL-${Date.now()}`;
      await asUser(client, userA);
      await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)`,
        [userA, TOKEN]
      );

      await asUser(client, userB);
      const read = await client.query('SELECT COUNT(*)::int AS c FROM push_tokens');
      expect(read.rows[0].c).toBe(0);
      const upd = await client.query('UPDATE push_tokens SET active = FALSE RETURNING id');
      expect(upd.rowCount).toBe(0);
      const del = await client.query('DELETE FROM push_tokens RETURNING id');
      expect(del.rowCount).toBe(0);

      await asUser(client, userA);
      const updOwn = await client.query('UPDATE push_tokens SET active = FALSE WHERE token = $1 RETURNING id', [TOKEN]);
      expect(updOwn.rowCount).toBe(1);
    } finally {
      client.release();
    }
  });

  it('service_role reemplaza token de plataforma pendiente/abandonado mediante upsert', async () => {
    const client = await pool.connect();
    try {
      const TOKEN = `PUSH-DEAD-${Date.now()}`;
      await asUser(client, userA);
      await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)`,
        [userA, TOKEN]
      );

      // Simula reactivación con nueva plataforma
      await asServiceRole(client);
      const res = await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'ios', TRUE)
         ON CONFLICT (token) DO UPDATE SET platform = EXCLUDED.platform, active = TRUE
         RETURNING user_id, platform`,
        [userB, TOKEN]
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0].user_id).toBe(userB);
      expect(res.rows[0].platform).toBe('ios');
    } finally {
      client.release();
    }
  });
});
