/**
 * Plantilla base: Fixture de fallo OAuth
 * NO IMPLEMENTAR - Esta es una plantilla para que los equipos T1-T5 la extiendan
 *
 * Objetivo: Simular y verificar comportamiento ante fallos en flujos OAuth
 * (Google, Supabase Auth, etc.)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiClient } from '../helpers/api-client';
import { createAuthenticatedTestUser, clearApiClientAuth } from '../helpers/auth';
import { closeTestPool } from '../helpers/db';

describe('OAuth Failure Fixtures - Plantilla Base', () => {
  let user: Awaited<ReturnType<typeof createAuthenticatedTestUser>>;

  beforeAll(async () => {
    user = await createAuthenticatedTestUser();
    apiClient.setAuthTokens(user.tokens!);
  });

  afterAll(async () => {
    clearApiClientAuth();
    await closeTestPool();
  });

  it('Fallo en callback OAuth: token inválido/expirado', async () => {
    // TODO T1-T5: Implementar
    // Simular callback con code inválido -> error manejado graciosamente
    // Verificar respuesta de error apropiada (no crash)
    expect(true).toBe(true);
  });

  it('Fallo en callback OAuth: state mismatch (CSRF)', async () => {
    // TODO T1-T5: Implementar
    // Verificar rechazo por state mismatch
    expect(true).toBe(true);
  });

  it('Fallo en refresh token: token revocado/expirado', async () => {
    // TODO T1-T5: Implementar
    // Usar refresh token antiguo/revocado -> 401, forzar re-login
    expect(true).toBe(true);
  });

  it('Fallo en Supabase Auth: red caída/timeout', async () => {
    // TODO T1-T5: Implementar
    // Mock network failure en Supabase -> error manejado, no crash
    expect(true).toBe(true);
  });

  it('Fallo en vinculación cuenta: email ya registrado', async () => {
    // TODO T1-T5: Implementar
    // Intentar vincular OAuth a email ya usado -> error claro
    expect(true).toBe(true);
  });
});