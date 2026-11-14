import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../modules/notifications/notification.service';
import { NotificationController } from '../modules/notifications/notification.controller';
import { supabase } from '../database/supabase';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import type { Response } from 'express';

vi.mock('../database/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('NotificationService - T2 Mobile Push & Session Remediation', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
  });

  describe('Atomic token registration and account reassignment', () => {
    it('uses onConflict: "token" for atomic upsert avoiding unique constraint violation', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'token-uuid-1',
          user_id: 'user-b',
          token: 'expo-token-device-1',
          platform: 'android',
          active: true,
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: {
          user_id: 'user-a',
          active: true,
          updated_at: '2026-11-13T20:00:00.000Z',
        },
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelectExisting = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'push_tokens') {
          return {
            select: vi.fn((fields) => {
              if (fields === 'user_id, active, updated_at') {
                return mockSelectExisting();
              }
              return mockSelect(fields);
            }),
            upsert: mockUpsert,
          } as any;
        }
        return {} as any;
      });

      const result = await service.registerPushToken('user-b', {
        token: 'expo-token-device-1',
        platform: 'android',
        clientTimestamp: '2026-11-13T21:00:00.000Z',
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-b',
          token: 'expo-token-device-1',
          platform: 'android',
          active: true,
        }),
        { onConflict: 'token' }
      );
      expect(result.user_id).toBe('user-b');
    });

    it('rejects stale registration from previous session if clientTimestamp is older than reallocated token', async () => {
      const existingTokenRecord = {
        user_id: 'user-b',
        active: true,
        updated_at: '2026-11-13T20:30:00.000Z',
      };

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: existingTokenRecord,
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelectExisting = vi.fn().mockReturnValue({ eq: mockEq });
      const mockUpsert = vi.fn();

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'push_tokens') {
          return {
            select: vi.fn(() => mockSelectExisting()),
            upsert: mockUpsert,
          } as any;
        }
        return {} as any;
      });

      // User A's slow request from 20:00 arrives after User B already took token at 20:30
      const result = await service.registerPushToken('user-a', {
        token: 'expo-token-device-1',
        platform: 'android',
        clientTimestamp: '2026-11-13T20:00:00.000Z',
      });

      expect(mockUpsert).not.toHaveBeenCalled();
      expect(result.user_id).toBe('user-b'); // Not reallocated back to user A
    });

    it('handles concurrent registrations without throwing unique constraint error', async () => {
      const mockSingle = vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: { id: 'uuid-1', user_id: 'user-b', token: 'tok-concurrent', active: true },
          error: null,
        })
      );
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(supabase.from).mockImplementation(() => {
        return {
          select: vi.fn((fields) => {
            if (fields === 'user_id, active, updated_at') {
              return { eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) };
            }
            return mockSelect();
          }),
          upsert: mockUpsert,
        } as any;
      });

      const p1 = service.registerPushToken('user-b', { token: 'tok-concurrent', platform: 'android' });
      const p2 = service.registerPushToken('user-b', { token: 'tok-concurrent', platform: 'android' });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenNthCalledWith(1, expect.any(Object), { onConflict: 'token' });
      expect(mockUpsert).toHaveBeenNthCalledWith(2, expect.any(Object), { onConflict: 'token' });
    });
  });

  describe('Idempotent token removal and unbind', () => {
    it('removes push token scoped strictly to user_id and token', async () => {
      const mockEqToken = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqToken });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'push_tokens') {
          return { delete: mockDelete } as any;
        }
        return {} as any;
      });

      await service.removePushToken('user-a', 'tok-123');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-a');
      expect(mockEqToken).toHaveBeenCalledWith('token', 'tok-123');
    });

    it('is idempotent when called multiple times on logout', async () => {
      const mockEqToken = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqToken });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });

      vi.mocked(supabase.from).mockImplementation(() => ({ delete: mockDelete } as any));

      await service.removePushToken('user-a', 'tok-123');
      await service.removePushToken('user-a', 'tok-123');

      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it('deactivates token when deactivatePushToken is called', async () => {
      const mockEqToken = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqToken });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUser });

      vi.mocked(supabase.from).mockImplementation(() => ({ update: mockUpdate } as any));

      await service.deactivatePushToken('user-a', 'tok-123');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ active: false })
      );
      expect(mockEqUser).toHaveBeenCalledWith('user_id', 'user-a');
      expect(mockEqToken).toHaveBeenCalledWith('token', 'tok-123');
    });
  });

  describe('Safe notification payload & privacy protection', () => {
    it('sanitizes data payload, strips sensitive account fields and attaches recipientUserId', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [{ token: 'tok-a-1' }],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: mockEq }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'push_tokens') {
          return { select: mockSelect } as any;
        }
        return {} as any;
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as Response);

      await service.sendPushNotification('user-a', {
        title: 'Sensible',
        body: 'Detalle de cuenta',
        data: {
          taskId: 'task-123',
          password: 'secret-password',
          email: 'user@example.com',
          accessToken: 'jwt.token.here',
        },
      });

      expect(fetchSpy).toHaveBeenCalled();
      const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      const sentMessage = callBody[0];

      expect(sentMessage.data.recipientUserId).toBe('user-a');
      expect(sentMessage.data.taskId).toBe('task-123');
      expect(sentMessage.data.password).toBeUndefined();
      expect(sentMessage.data.email).toBeUndefined();
      expect(sentMessage.data.accessToken).toBeUndefined();

      fetchSpy.mockRestore();
    });

    it('uses generic fallback with no title when recipient is not guaranteed', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [{ token: 'tok-a-1' }],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: mockEq }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'push_tokens') {
          return { select: mockSelect } as any;
        }
        return {} as any;
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as Response);

      await service.sendPushNotification(
        'user-a',
        {
          title: 'Cita con Dr. Psiquiatra',
          body: 'Reunión en la clínica privada a las 15:00',
          data: { appointmentId: 'app-99' },
        },
        { guaranteedRecipient: false }
      );

      const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      const sentMessage = callBody[0];

      expect(sentMessage.title).toBe(''); // Sin título si no hay garantía
      expect(sentMessage.body).toBe('Tienes una nueva notificación');
      expect(sentMessage.data.recipientUserId).toBe('user-a');
      expect(sentMessage.data.appointmentId).toBe('app-99');

      fetchSpy.mockRestore();
    });

    it('deactivates invalid token when Expo returns DeviceNotRegistered', async () => {
      const mockEq = vi.fn().mockResolvedValue({
        data: [{ token: 'tok-invalid' }],
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: mockEq }),
      });

      const mockEqToken = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqToken });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'push_tokens') {
          return {
            select: mockSelect,
            update: mockUpdate,
          } as any;
        }
        return {} as any;
      });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              status: 'error',
              message: 'The recipient is not registered',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
      } as Response);

      await service.sendPushNotification('user-a', {
        title: 'Hola',
        body: 'Mundo',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ active: false })
      );
      expect(mockEqToken).toHaveBeenCalledWith('token', 'tok-invalid');

      fetchSpy.mockRestore();
    });
  });
});

describe('NotificationController - removePushToken', () => {
  let controller: NotificationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new NotificationController();
  });

  it('accepts token from request body', async () => {
    const req = {
      userId: 'user-a',
      body: { token: 'tok-from-body' },
      query: {},
    } as unknown as AuthenticatedRequest;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn();

    const removeSpy = vi
      .spyOn(NotificationService.prototype, 'removePushToken')
      .mockResolvedValue(undefined);

    await controller.removePushToken(req, res, next);

    expect(removeSpy).toHaveBeenCalledWith('user-a', 'tok-from-body');
    expect(res.json).toHaveBeenCalledWith({ message: 'Push token removed' });
  });

  it('accepts token from request query parameter', async () => {
    const req = {
      userId: 'user-a',
      body: {},
      query: { token: 'tok-from-query' },
    } as unknown as AuthenticatedRequest;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn();

    const removeSpy = vi
      .spyOn(NotificationService.prototype, 'removePushToken')
      .mockResolvedValue(undefined);

    await controller.removePushToken(req, res, next);

    expect(removeSpy).toHaveBeenCalledWith('user-a', 'tok-from-query');
    expect(res.json).toHaveBeenCalledWith({ message: 'Push token removed' });
  });

  it('returns 400 if token is missing in both body and query', async () => {
    const req = {
      userId: 'user-a',
      body: {},
      query: {},
    } as unknown as AuthenticatedRequest;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const next = vi.fn();

    await controller.removePushToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is required' });
  });
});
