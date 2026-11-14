import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient, SupabaseClient, AuthApiError, UserAttributes, UserResponse, User } from '@supabase/supabase-js';
import { env } from '../config/env';

const clients = new AsyncLocalStorage<{ client: SupabaseClient; userId: string; token?: string }>();
const authOptions = { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false };

function publicKey() {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY is required');
  return key;
}

// Auth methods may change in-memory session state even with persistSession=false.
// Never share an auth client across requests or with a service-role client.
export function createUserClient(token?: string) {
  return createClient(env.supabaseUrl, publicKey(), {
    auth: authOptions,
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
}

export function runWithUserClient<T>(client: SupabaseClient, userId: string, callback: () => T, token?: string): T {
  return clients.run({ client, userId, token }, callback);
}

// Only the internal reminder checker may use this unscoped enumeration client.
// It never authenticates users and the composite FK guarantees consistent joins.
export function createReminderCheckerClient() {
  if (clients.getStore()) throw new Error('Checker client is only available outside request contexts');
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: authOptions });
}

// Internal notification work has an explicit expected recipient. Enforce scope
// at the transport boundary, including existing token cleanup queries.
export function runWithSystemUser<T>(userId: string, callback: () => T): T {
  if (clients.getStore()) throw new Error('Internal notification scope cannot elevate a request');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Expected internal user identity');
  }
  const scopedFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!['/rest/v1/notifications', '/rest/v1/push_tokens'].includes(url.pathname)) {
      throw new Error('Table outside internal notification scope');
    }
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST' || method === 'PATCH') {
      if (typeof init?.body !== 'string') throw new Error('Expected JSON notification payload');
      const body: unknown = JSON.parse(init.body);
      const rows: unknown[] = Array.isArray(body) ? body : [body];
      for (const row of rows) {
        if (!row || typeof row !== 'object') throw new Error('Invalid notification payload');
        if ((method === 'POST' || 'user_id' in row) && (!('user_id' in row) || row.user_id !== userId)) {
          throw new Error('Internal notification recipient mismatch');
        }
      }
    }
    url.searchParams.set('user_id', `eq.${userId}`);
    return fetch(url, init);
  };
  const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: authOptions, global: { fetch: scopedFetch },
  });
  return clients.run({ client, userId }, callback);
}

// Auth updateUser requires a refreshable SDK session. A bearer-only request
// instead calls the same user endpoint with its verified JWT, without inventing
// refresh tokens or using admin.updateUserById.
export async function updateVerifiedUser(attributes: UserAttributes): Promise<UserResponse> {
  const context = clients.getStore();
  if (!context?.token) throw new Error('Verified user context required');
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: publicKey(), Authorization: `Bearer ${context.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(attributes),
  });
  const body = await response.json() as User & { user?: User; message?: string; msg?: string; code?: string };
  if (!response.ok) {
    return { data: { user: null }, error: new AuthApiError(body.message ?? body.msg ?? 'User update failed', response.status, body.code) };
  }
  const user = body.user ?? body;
  if (user.id !== context.userId) throw new Error('Updated user identity mismatch');
  return { data: { user }, error: null };
}

export async function signOutVerifiedUser(token: string) {
  const { data, error } = await createUserClient(token).auth.getUser(token);
  const context = clients.getStore();
  if (error || !data.user || !context || data.user.id !== context.userId) {
    throw new Error('Logout identity does not match authenticated request');
  }
  // This one privileged Auth call is bound to the independently verified token.
  const admin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: authOptions });
  return admin.auth.admin.signOut(token);
}

// Preserve existing service imports. Outside a verified request, access is
// anonymous and ephemeral; there is deliberately no service-role fallback.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const client = clients.getStore()?.client ?? createUserClient();
    const value: unknown = Reflect.get(client, property, client);
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
