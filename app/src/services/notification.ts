import * as SecureStore from 'expo-secure-store';
import { apiClient } from './api';
import { supabase } from './supabase';

const PENDING_OPS_KEY = 'pending_push_token_ops';

export interface PendingPushOp {
  type: 'remove';
  token: string;
  userId?: string;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

async function getStoredQueue(): Promise<PendingPushOp[]> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_OPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveStoredQueue(queue: PendingPushOp[]): Promise<void> {
  try {
    if (queue.length === 0) {
      await SecureStore.deleteItemAsync(PENDING_OPS_KEY);
    } else {
      await SecureStore.setItemAsync(PENDING_OPS_KEY, JSON.stringify(queue));
    }
  } catch {}
}

class NotificationService {
  private cachedDeviceToken: string | null = null;

  setDevicePushToken(token: string | null) {
    this.cachedDeviceToken = token;
  }

  getDevicePushToken(): string | null {
    return this.cachedDeviceToken;
  }

  private async getToken(): Promise<string> {
    if (!supabase) return '';
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  async registerPushToken(
    pushToken: string,
    platform: 'android' | 'ios' | 'web' = 'android'
  ): Promise<void> {
    this.cachedDeviceToken = pushToken;
    const token = await this.getToken();
    const clientTimestamp = new Date().toISOString();
    await apiClient.post(
      '/notifications/push-token',
      { token: pushToken, platform, clientTimestamp },
      token
    );
  }

  async removePushToken(pushToken: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.delete(
      `/notifications/push-token?token=${encodeURIComponent(pushToken)}`,
      token,
      { token: pushToken }
    );
  }

  /**
   * Desvinculación idempotente del token en el cierre de sesión,
   * ejecutada ANTES de invalidar la sesión mientras hay red.
   * Si no hay red, encola la desvinculación localmente para reintentar al reconectar.
   */
  async unbindCurrentDevice(): Promise<void> {
    const pushToken = this.cachedDeviceToken;
    if (!pushToken) return;

    let userId: string | undefined;
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    try {
      await this.removePushToken(pushToken);
      this.cachedDeviceToken = null;
    } catch (err) {
      // Cierre offline: persistir en cola local y reintentar al reconectar
      const queue = await getStoredQueue();
      const filtered = queue.filter((op) => op.token !== pushToken);
      filtered.push({
        type: 'remove',
        token: pushToken,
        userId,
        timestamp: Date.now(),
      });
      await saveStoredQueue(filtered);
      this.cachedDeviceToken = null;
    }
  }

  /**
   * Procesa la cola de operaciones pendientes tras reconectar o al iniciar sesión.
   */
  async flushPendingOperations(): Promise<void> {
    const queue = await getStoredQueue();
    if (queue.length === 0) return;

    const remaining: PendingPushOp[] = [];
    for (const op of queue) {
      if (op.type === 'remove') {
        try {
          await this.removePushToken(op.token);
        } catch (err) {
          const isNetwork =
            err instanceof Error &&
            (err.name === 'TimeoutError' || err.message.includes('fetch') || err.message.includes('Sin conexión'));
          if (isNetwork) {
            remaining.push(op);
          }
          // Si falló por 400/401/404, descartamos para no acumular basura obsoleta
        }
      }
    }
    await saveStoredQueue(remaining);
  }

  async listNotifications(limit: number = 50): Promise<AppNotification[]> {
    const token = await this.getToken();
    return apiClient.get<AppNotification[]>(`/notifications?limit=${limit}`, token);
  }

  async markAsRead(notificationId: string): Promise<void> {
    const token = await this.getToken();
    await apiClient.patch(`/notifications/${notificationId}/read`, {}, token);
  }

  async markAllAsRead(): Promise<void> {
    const token = await this.getToken();
    await apiClient.patch('/notifications/read-all', {}, token);
  }

  async getUnreadCount(): Promise<number> {
    const token = await this.getToken();
    const result = await apiClient.get<{ count: number }>('/notifications/unread-count', token);
    return result.count;
  }
}

export const notificationService = new NotificationService();
