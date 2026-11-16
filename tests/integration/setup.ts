/**
 * Configuración global de tests de integración
 * Se ejecuta antes de todos los tests (globalSetup en vitest.config)
 */

import { getTestPool } from './helpers/db';

export default async function globalSetup(): Promise<void> {
  console.log('[Integration Tests] Global setup starting...');

  // Verificar que la infraestructura está levantada
  // (docker-compose -f tests/integration/docker-compose.yml up -d)

  const pool = getTestPool();

  try {
    // Test de conexión
    await pool.query('SELECT 1');
    console.log('[Integration Tests] Database connection OK');
  } catch (error) {
    console.error('[Integration Tests] Database connection failed:', error);
    throw new Error('Database not ready. Run docker-compose up -d first.');
  }

  // Opcional: Ejecutar migraciones si no lo hace docker-entrypoint
  // await runMigrations();

  console.log('[Integration Tests] Global setup complete');
}