/**
 * Fixture de cambio de sesión / dispositivos (T2)
 *
 * Objetivo:
 * - ÚNICO(token) global: no es posible registrar el mismo token para dos
 *   cuentas simultáneamente (UNIQUE violation).
 * - RLS: el token solo es visible para su dueño; B no lo ve ni lo puede
 *   sobrescribir vía UPDATE.
 * - Reasignación atómica: el servicio (service_role) puede reasignar el
 *   token durante el paso de login — equivalente al endpoint `registerPushToken`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import {
  prepareCleanDatabase,
  insertAuthUser,
  asUser,
  asServiceRole,
} from '../helpers/bootstrap';

describe('Session Change Fixtures (push token ownership)', () => {
  const pool = getTestPool();
  let userA = '';
  let userB = '';
  const T = `PUSH-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
      userA = await insertAuthUser(client, 'session-a@example.com');
      userB = await insertAuthUser(client, 'session-b@example.com');
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('A inserta token; A ve 1 fila; B no ve ninguna; A UPDATE lo marca inactive; B UPDATE afecta 0', async () => {
    const client = await pool.connect();
    try {
      const TOK = `PUSH-A-FIRST-${Date.now()}`;
      await asUser(client, userA);
      await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)`,
        [userA, TOK]
      );
      const inserted = await client.query(
        `SELECT COUNT(*)::int AS c FROM push_tokens`
      );
      expect(inserted.rows[0].c).toBe(1);

      // B no ve nada
      await asUser(client, userB);
      const bView = await client.query(`SELECT COUNT(*)::int AS c FROM push_tokens`);
      expect(bView.rows[0].c).toBe(0);

      // B no puede actualizar lo ajeno
      const bUpdate = await client.query(
        `UPDATE push_tokens SET active = FALSE RETURNING id`
      );
      expect(bUpdate.rowCount).toBe(0);

      // A sí
      await asUser(client, userA);
      const aUpdate = await client.query(
        `UPDATE push_tokens SET active = TRUE RETURNING id`
      );
      expect(aUpdate.rowCount).toBe(1);
    } finally {
      client.release();
    }
  });

  it('UNIQUE(token): B no puede por|ser registrar el token que ya tiene A', async () => {
    const client = await pool.connect();
    try {
      await asUser(client, userA);
      await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)`,
        [userA, T]
      );

      await asUser(client, userB);
      await expect(
        client.query(
          `INSERT INTO push_tokens (user_id, token, platform, active)
           VALUES ($1, $2, 'android', TRUE)`,
          [userB, T]
        )
      ).rejects.toThrow(/unique|duplicate/i);
    } finally {
      client.release();
    }
  });

  it('service_role reasigna el token de A a B vía upsert (contrato registerPushToken)', async () => {
    const client = await pool.connect();
    try {
      const TOKEN = `PUSH-REASSIGN-${Date.now()}`;
      await asUser(client, userA);
      await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)`,
        [userA, TOKEN]
      );

      // Simula el endpoint registerPushToken con token existente:
      // service-role emite upsert con el user_id actual.
      await asServiceRole(client);
      const result = await client.query(
        `INSERT INTO push_tokens (user_id, token, platform, active)
         VALUES ($1, $2, 'android', TRUE)
         ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id,
                                          platform = EXCLUDED.platform,
                                          active = TRUE
         RETURNING user_id, token`,
        [userB, TOKEN]
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].user_id).toBe(userB);

      // Tras reasignar, A no ve ya el token y B sí
      await asUser(client, userA);
      const aView = await client.query(`SELECT COUNT(*)::int AS c FROM push_tokens WHERE token = $1`, [TOKEN]);
      expect(aView.rows[0].c).toBe(0);

      await asUser(client, userB);
      const bView = await client.query(`SELECT COUNT(*)::int AS c FROM push_tokens WHERE token = $1`, [TOKEN]);
      expect(bView.rows[0].c).toBe(1);
    } finally {
      client.release();
    }
  });
});
