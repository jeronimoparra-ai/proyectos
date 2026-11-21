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
      rpc: vi.fn(),
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
    it('uses the atomic authenticated registration RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ user_id: 'user-b', active: true }], error: null } as never);
      const result = await service.registerPushToken('user-b', { token: 'token', platform: 'android' });
      expect(supabase.rpc).toHaveBeenCalledWith('register_push_token_atomic', {
        p_user_id: 'user-b', p_token: 'token', p_platform: 'android', p_client_timestamp: null,
      });
      expect(result.user_id).toBe('user-b');
    });

    it('does not disclose another owner on stale registration', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
      const result = await service.registerPushToken('user-a', { token: 'token', platform: 'android', clientTimestamp: '2026-01-01T00:00:00Z' });
      expect(result).toEqual({ user_id: 'user-a', token: 'token', platform: 'android', active: false });
    });

    it('propagates storage failures', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: 'failure' } } as never);
      await expect(service.registerPushToken('user-b', { token: 'token', platform: 'android' })).rejects.toThrow('failure');
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

describe('P4 provider acceptance and reminder privacy', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('records accepted rather than delivered and attaches recipient to generic push', async () => {
    const service = new NotificationService();
    vi.spyOn(service, 'createNotification').mockResolvedValue({ id: 'notice' });
    const send = vi.spyOn(service, 'sendPushNotification').mockResolvedValue([{ token: 'synthetic', success: true, error: null, messageId: 'ticket' }]);
    const receipt = vi.spyOn(service, 'recordDeliveryReceipt').mockResolvedValue();
    const result = await service.sendReminderNotification('owner', 'Private task', '2026-01-01');
    expect(result.accepted).toBe(true);
    expect(receipt).toHaveBeenCalledWith('notice', 'accepted', ['ticket'], expect.any(Array));
    expect(send).toHaveBeenCalledWith('owner', expect.any(Object), { guaranteedRecipient: false });
  });

  it('uses the existing notification primary key for retry deduplication and skips accepted sends', async () => {
    const service = new NotificationService();
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const row = { id: 'reminder', data: { delivery: { status: 'accepted' } } };
    const builder = { eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: row, error: null }) };
    vi.mocked(supabase.from).mockReturnValue({ upsert, select: vi.fn(() => builder) } as never);
    const send = vi.spyOn(service, 'sendPushNotification');
    const result = await service.sendReminderNotification('owner', 'Task', '2026-01-01', { reminderId: 'reminder' });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'reminder', user_id: 'owner' }), { onConflict: 'id', ignoreDuplicates: true });
    expect(result.accepted).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not persist push tokens in user-readable notification data', async () => {
    const service = new NotificationService();
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { data: { reminderId: 'r' } }, error: null }) })) })), update,
    } as never);
    await service.recordDeliveryReceipt('n', 'accepted', ['ticket'], [{ token: 'sensitive-device-token', success: true, error: null, messageId: 'ticket' }]);
    expect(JSON.stringify(update.mock.calls)).not.toContain('sensitive-device-token');
    expect(update).toHaveBeenCalledWith({ data: expect.objectContaining({ reminderId: 'r', delivery: expect.objectContaining({ status: 'accepted' }) }) });
  });
});
