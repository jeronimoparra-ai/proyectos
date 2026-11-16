import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../modules/notifications/notification.service';
import { supabase } from '../database/supabase';

vi.mock('../database/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('Mobile Push & Multi-Device Session Acceptance Criteria', () => {
  let service: NotificationService;

  // In-memory simulation of the push_tokens database table
  interface DbTokenRow {
    id: string;
    user_id: string;
    token: string;
    platform: string;
    active: boolean;
    updated_at: string;
  }

  let dbPushTokens: DbTokenRow[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
    dbPushTokens = [];

    // Realistic mock of Supabase chaining for push_tokens table
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table !== 'push_tokens') return {} as any;

      return {
        select: vi.fn((fields?: string) => {
          return {
            eq: vi.fn((col1: string, val1: any) => {
              return {
                maybeSingle: vi.fn(async () => {
                  const found = dbPushTokens.find((r) => (r as any)[col1] === val1);
                  return { data: found ? { ...found } : null, error: null };
                }),
                eq: vi.fn((col2: string, val2: any) => {
                  // e.g. .eq('user_id', userId).eq('active', true)
                  const filtered = dbPushTokens.filter(
                    (r) => (r as any)[col1] === val1 && (r as any)[col2] === val2
                  );
                  return Promise.resolve({ data: filtered.map((f) => ({ ...f })), error: null });
                }),
              };
            }),
          };
        }),
        upsert: vi.fn((row: Partial<DbTokenRow>, options?: { onConflict: string }) => {
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const conflictTarget = options?.onConflict ?? 'token';
                const conflictVal = (row as any)[conflictTarget];
                const existingIndex = dbPushTokens.findIndex(
                  (r) => (r as any)[conflictTarget] === conflictVal
                );

                if (existingIndex >= 0) {
                  // Atomic update on conflict
                  dbPushTokens[existingIndex] = {
                    ...dbPushTokens[existingIndex],
                    ...row,
                    updated_at: row.updated_at ?? new Date().toISOString(),
                  };
                  return { data: { ...dbPushTokens[existingIndex] }, error: null };
                } else {
                  // Insert
                  const newRow: DbTokenRow = {
                    id: `id-${Math.random()}`,
                    user_id: row.user_id!,
                    token: row.token!,
                    platform: row.platform ?? 'android',
                    active: row.active ?? true,
                    updated_at: row.updated_at ?? new Date().toISOString(),
                  };
                  dbPushTokens.push(newRow);
                  return { data: { ...newRow }, error: null };
                }
              }),
            })),
          };
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((col1: string, val1: any) => ({
            eq: vi.fn(async (col2: string, val2: any) => {
              dbPushTokens = dbPushTokens.filter(
                (r) => !((r as any)[col1] === val1 && (r as any)[col2] === val2)
              );
              return { data: null, error: null };
            }),
          })),
        })),
        update: vi.fn((updates: Partial<DbTokenRow>) => ({
          eq: vi.fn((col1: string, val1: any) => ({
            eq: vi.fn(async (col2: string, val2: any) => {
              dbPushTokens = dbPushTokens.map((r) => {
                if ((r as any)[col1] === val1 && (r as any)[col2] === val2) {
                  return { ...r, ...updates };
                }
                return r;
              });
              return { data: null, error: null };
            }),
          })),
        })),
      } as any;
    });
  });

  it('A logs out, B logs in on same device: token is reallocated without conflict, A notices stop going to B, other device of A continues working', async () => {
    // 1. User A has Phone (TOKEN_PHONE) and Tablet (TOKEN_TABLET)
    await service.registerPushToken('user_a', {
      token: 'TOKEN_PHONE',
      platform: 'android',
    });
    await service.registerPushToken('user_a', {
      token: 'TOKEN_TABLET',
      platform: 'android',
    });

    // Verify User A has 2 active push tokens
    const tokensUserABefore = await service.getPushTokens('user_a');
    expect(tokensUserABefore).toEqual(['TOKEN_PHONE', 'TOKEN_TABLET']);

    // 2. User A signs out on Phone: Phone unbinds TOKEN_PHONE
    await service.removePushToken('user_a', 'TOKEN_PHONE');

    // User A's tablet is still active!
    const tokensUserAAfterLogoutPhone = await service.getPushTokens('user_a');
    expect(tokensUserAAfterLogoutPhone).toEqual(['TOKEN_TABLET']);

    // 3. User B signs in on the same Phone: registers TOKEN_PHONE
    await service.registerPushToken('user_b', {
      token: 'TOKEN_PHONE',
      platform: 'android',
    });

    // 4. Verify tokens:
    // User B now owns TOKEN_PHONE
    const tokensUserB = await service.getPushTokens('user_b');
    expect(tokensUserB).toEqual(['TOKEN_PHONE']);

    // User A still owns TOKEN_TABLET and DOES NOT have TOKEN_PHONE
    const tokensUserAFinal = await service.getPushTokens('user_a');
    expect(tokensUserAFinal).toEqual(['TOKEN_TABLET']);
    expect(tokensUserAFinal).not.toContain('TOKEN_PHONE');
  });

  it('Offline logout followed by B login: late unbind from A does not delete B token', async () => {
    // 1. User A is on device with TOKEN_PHONE
    await service.registerPushToken('user_a', {
      token: 'TOKEN_PHONE',
      platform: 'android',
    });

    // 2. User A logs out OFFLINE: network call fails, operation enqueued locally
    // Meanwhile User B logs in online on the same device and claims TOKEN_PHONE
    await service.registerPushToken('user_b', {
      token: 'TOKEN_PHONE',
      platform: 'android',
      clientTimestamp: new Date(Date.now() + 5000).toISOString(),
    });

    // In DB, TOKEN_PHONE now belongs to user_b
    expect(dbPushTokens.find((r) => r.token === 'TOKEN_PHONE')?.user_id).toBe('user_b');

    // 3. User A reconnects and offline queue flushes: calls removePushToken('user_a', 'TOKEN_PHONE')
    await service.removePushToken('user_a', 'TOKEN_PHONE');

    // 4. Verification:
    // The token belonged to user_b, so user_a's removal did not touch user_b's token!
    const tokensUserB = await service.getPushTokens('user_b');
    expect(tokensUserB).toEqual(['TOKEN_PHONE']);
    expect(dbPushTokens.find((r) => r.token === 'TOKEN_PHONE')?.user_id).toBe('user_b');
  });

  it('Late registration from session A does not overwrite session B', async () => {
    // 1. User A starts registration at T1
    const t1 = '2026-11-13T10:00:00.000Z';
    // User A logs out before response completes.

    // 2. User B logs in and registers at T2
    const t2 = '2026-11-13T10:05:00.000Z';
    await service.registerPushToken('user_b', {
      token: 'TOKEN_SHARED',
      platform: 'android',
      clientTimestamp: t2,
    });

    // Set updated_at to t2 in db
    const row = dbPushTokens.find((r) => r.token === 'TOKEN_SHARED');
    if (row) row.updated_at = t2;

    // 3. User A's slow/delayed retry from T1 finally reaches the server at T3
    await service.registerPushToken('user_a', {
      token: 'TOKEN_SHARED',
      platform: 'android',
      clientTimestamp: t1, // older than t2!
    });

    // 4. Verification: Token remains with user_b!
    const currentOwner = dbPushTokens.find((r) => r.token === 'TOKEN_SHARED')?.user_id;
    expect(currentOwner).toBe('user_b');
  });
});
