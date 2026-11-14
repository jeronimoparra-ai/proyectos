/**
 * Fixtures de fallo OAuth (estado inválido/caducado/consumido) a nivel DB.
 * Google token exchange real: pendiente (simulado en unit tests T3).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import { asUser, insertAuthUser, prepareCleanDatabase } from '../helpers/bootstrap';

function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

describe('OAuth Failure Fixtures', () => {
  const pool = getTestPool();
  let userId = '';

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
      userId = await insertAuthUser(client, 'oauth-fail@example.com');
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('rechaza complete_calendar_connection con state caducado', async () => {
    const stateHash = hashState(`expired-${Date.now()}`);
    await pool.query(
      `INSERT INTO calendar_oauth_states (state_hash, user_id, redirect_uri, expires_at, consumed_at)
       VALUES ($1, $2, 'productivityapp://oauth', now() - interval '1 minute', now())`,
      [stateHash, userId]
    );
    await expect(
      pool.query(
        `SELECT complete_calendar_connection($1, $2, 'productivityapp://oauth',
          '{"access_token":"a","refresh_token":"r","token_expires_at":"2099-01-01T00:00:00Z"}'::jsonb)`,
        [userId, stateHash]
      )
    ).rejects.toThrow(/expired|disconnected|start again/i);
  });

  it('rechaza state ya consumido (replay)', async () => {
    const stateHash = hashState(`consumed-${Date.now()}`);
    await pool.query(
      `INSERT INTO calendar_oauth_states (state_hash, user_id, redirect_uri, expires_at, consumed_at)
       VALUES ($1, $2, 'productivityapp://oauth', now() + interval '10 minutes', now())`,
      [stateHash, userId]
    );
    await pool.query(
      `SELECT complete_calendar_connection($1, $2, 'productivityapp://oauth',
        '{"access_token":"a1","refresh_token":"r1","token_expires_at":"2099-01-01T00:00:00Z"}'::jsonb)`,
      [userId, stateHash]
    );
    await expect(
      pool.query(
        `SELECT complete_calendar_connection($1, $2, 'productivityapp://oauth',
          '{"access_token":"a2","refresh_token":"r2","token_expires_at":"2099-01-01T00:00:00Z"}'::jsonb)`,
        [userId, stateHash]
      )
    ).rejects.toThrow(/expired|disconnected|start again/i);
  });

  it('authenticated no puede leer calendar_oauth_states (service_role only)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await asUser(client, userId);
      await expect(client.query(`SELECT * FROM calendar_oauth_states`)).rejects.toThrow(
        /permission denied/i
      );
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('PENDIENTE dispositivo: intercambio Google OAuth real no ejecutado aquí (solo SQL/simulado)', () => {
    expect(process.env.GOOGLE_OAUTH_LIVE).toBeUndefined();
  });
});
