/**
 * Limpieza global de tests de integración
 * Se ejecuta después de todos los tests (globalTeardown en vitest.config)
 */

import { closeTestPool } from './helpers/db';

export default async function globalTeardown(): Promise<void> {
  console.log('[Integration Tests] Global teardown starting...');

  try {
    await closeTestPool();
    console.log('[Integration Tests] Database pool closed');
  } catch (error) {
    console.error('[Integration Tests] Error during teardown:', error);
  }

  // Opcional: Bajar infraestructura
  // docker-compose -f tests/integration/docker-compose.yml down

  console.log('[Integration Tests] Global teardown complete');
}