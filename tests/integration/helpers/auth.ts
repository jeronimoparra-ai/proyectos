/**
 * Helpers de autenticación para tests de integración
 * Proporciona utilidades para crear usuarios, tokens y manejar auth en tests
 */

import { apiClient, type AuthTokens, type ApiResponse } from './api-client';
import { createTestUser, type TestDatabaseConfig } from './db';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  tokens?: AuthTokens;
}

/**
 * Crea un usuario de prueba completo (en BD + registrado via API)
 */
export async function createAuthenticatedTestUser(
  overrides: Partial<{ email: string; password: string; displayName: string }> = {},
  dbConfig?: TestDatabaseConfig
): Promise<TestUser> {
  const email = overrides.email ?? `test-${Date.now()}@example.com`;
  const password = overrides.password ?? 'TestPass123!';
  const displayName = overrides.displayName ?? 'Test User';

  // Crear usuario en BD directamente (para tests que necesiten user_id inmediato)
  const userId = await createTestUser(email, dbConfig);

  // Registrar via API para obtener tokens reales
  const registerResult = await apiClient.register(email, password, displayName);

  if (!registerResult.success || !registerResult.data?.tokens) {
    throw new Error(`Failed to register test user: ${registerResult.error}`);
  }

  return {
    id: userId,
    email,
    password,
    displayName,
    tokens: registerResult.data.tokens,
  };
}

/**
 * Autentica un usuario existente y obtiene tokens
 */
export async function authenticateTestUser(
  email: string,
  password: string
): Promise<AuthTokens> {
  const loginResult = await apiClient.login(email, password);

  if (!loginResult.success || !loginResult.data?.tokens) {
    throw new Error(`Failed to login test user: ${loginResult.error}`);
  }

  return loginResult.data.tokens;
}

/**
 * Configura el cliente API con tokens de autenticación
 */
export function setApiClientAuth(tokens: AuthTokens): void {
  apiClient.setAuthTokens(tokens);
}

/**
 * Limpia la autenticación del cliente API
 */
export function clearApiClientAuth(): void {
  apiClient.clearAuthTokens();
}

/**
 * Crea múltiples usuarios de prueba para tests de aislamiento entre cuentas
 */
export async function createTestUsers(
  count: number,
  dbConfig?: TestDatabaseConfig
): Promise<TestUser[]> {
  const users: TestUser[] = [];

  for (let i = 0; i < count; i++) {
    const user = await createAuthenticatedTestUser({
      email: `test-user-${i}-${Date.now()}@example.com`,
      displayName: `Test User ${i}`,
    }, dbConfig);
    users.push(user);
  }

  return users;
}

/**
 * Verifica que dos usuarios no pueden acceder a datos del otro (aislamiento)
 */
export async function verifyAccountIsolation(
  userA: TestUser,
  userB: TestUser,
  checkFn: (client: typeof apiClient) => Promise<ApiResponse<unknown>>
): Promise<{ isolated: boolean; details: string }> {
  // Usuario A intenta acceder a datos de Usuario B
  setApiClientAuth(userA.tokens!);
  try {
    await checkFn(apiClient);
    return { isolated: false, details: 'User A accessed User B data' };
  } catch (error) {
    // Esperado: error 403/404
    if (error instanceof Error && ('statusCode' in error)) {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode === 403 || statusCode === 404) {
        return { isolated: true, details: 'Proper isolation enforced' };
      }
    }
    return { isolated: false, details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearApiClientAuth();
  }
}

/**
 * Refresh token helper para tests de expiración/rotación
 */
export async function refreshUserToken(refreshToken: string): Promise<AuthTokens> {
  const result = await apiClient.refreshToken(refreshToken);

  if (!result.success || !result.data?.tokens) {
    throw new Error(`Failed to refresh token: ${result.error}`);
  }

  return result.data.tokens;
}