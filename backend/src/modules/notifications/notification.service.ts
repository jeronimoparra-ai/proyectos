import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';
import type { RegisterPushTokenInput } from './notification.schema';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

export class NotificationService {
  async registerPushToken(userId: string, input: RegisterPushTokenInput) {
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token: input.token, platform: input.platform, active: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      )
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return data;
  }

  async removePushToken(userId: string, token: string) {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
  }

  async getPushTokens(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return (data ?? []).map((t) => t.token);
  }

  async listNotifications(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return data ?? [];
  }

  async markAsRead(userId: string, notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
  }

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return count ?? 0;
  }

  async createNotification(userId: string, title: string, body: string, type: string = 'general', data?: Record<string, unknown>) {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, body, type, data })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return notification;
  }

  async sendPushNotification(userId: string, payload: PushPayload): Promise<boolean> {
    const tokens = await this.getPushTokens(userId);
    if (tokens.length === 0) return false;

    const messages = tokens.map((token) => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
      sound: 'default',
      channelId: 'default',
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.error('Expo push error:', response.status, await response.text());
        return false;
      }

      const result = await response.json() as { data?: Array<{ status: string; message?: string }> };
      if (result.data) {
        for (const item of result.data) {
          if (item.status === 'error' && item.message === 'DeviceNotRegistered') {
            const idx = result.data.indexOf(item);
            const failedToken = tokens[idx];
            if (failedToken) {
              await supabase.from('push_tokens').delete().eq('token', failedToken);
            }
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  async sendReminderNotification(userId: string, taskTitle: string, remindAt: string, data?: Record<string, unknown>) {
    const notification = await this.createNotification(
      userId,
      'Recordatorio',
      `Recordatorio: ${taskTitle}`,
      'reminder',
      data
    );

    await this.sendPushNotification(userId, {
      title: 'Recordatorio',
      body: taskTitle,
      data: { ...data, notificationId: notification.id },
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
