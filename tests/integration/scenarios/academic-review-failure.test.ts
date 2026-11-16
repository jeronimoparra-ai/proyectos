/**
 * Fixture de fallo en revisión/creación académica (SM-2)
 *
 * Objetivo: verificar que `create_academic_task_atomic` (y utilidades de
 * revisión) son ALL-OR-NOTHING — cualquier fallo interno no persiste
 * escritura parcial.
 *
 * Alcance de la "transacción": función RPC completa — si algo falla,
 * la llamada entera se deshace.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { closeTestPool, getTestPool, grantRoleMembership } from '../helpers/db';
import { prepareCleanDatabase, insertAuthUser, asUser } from '../helpers/bootstrap';

describe('Academic Failure Fixtures (rollback atómico)', () => {
  const pool = getTestPool();
  let userId = '';

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await prepareCleanDatabase(client);
      await grantRoleMembership(client);
      userId = await insertAuthUser(client, 'academic-fail@example.com');
    } finally {
      client.release();
    }
  }, 120_000);

  afterAll(async () => {
    await closeTestPool();
  });

  it('create_academic_task_atomic revierte TODO en fallo (ni tarea, ni material)', async () => {
    const client = await pool.connect();
    try {
      // Sin BEGIN: cada query se autentifica y ejecuta como transacción propia,
      // garantizando que validate vea el estado real tras el rollback interno.
      await asUser(client, userId);

      // Materia con tipo inválido: viola study_materials_type_check.
      const bogusMaterials = JSON.stringify([
        { type: 'bogus-materia', content: 'contenido que nunca debe persistir' },
      ]);

      await expect(
        client.query(
          `SELECT * FROM create_academic_task_atomic($1, 'Tarea fallida', 'Biología', 'contenido', $2::jsonb)`,
          [userId, bogusMaterials]
        )
      ).rejects.toThrow(/check|violates/i);

      // Nada persistido: ni la tarea, ni los materiales (transacción implícita hizo rollback).
      await asUser(client, userId);
      const tasks = await client.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM academic_tasks');
      await asUser(client, userId);
      const materials = await client.query<{ c: number }>(
        'SELECT COUNT(*)::int AS c FROM study_materials'
      );
      expect(tasks.rows[0].c).toBe(0);
      expect(materials.rows[0].c).toBe(0);
    } finally {
      client.release();
    }
  });

  it('create_academic_task_atomic con user scope-mismatch rechaza sin escribir', async () => {
    const client = await pool.connect();
    try {
      await asUser(client, userId);

      const otherId = '00000000-0000-4000-8000-000000000001';
      await expect(
        client.query(
          `SELECT create_academic_task_atomic($1, 'Tarea ajena', 'Biología', 'x', '[]'::jsonb)`,
          [otherId]
        )
      ).rejects.toThrow(/scope mismatch|42501|not allowed/i);

      await asUser(client, userId);
      const tasks = await client.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM academic_tasks');
      expect(tasks.rows[0].c).toBe(0);
    } finally {
      client.release();
    }
  });
});
