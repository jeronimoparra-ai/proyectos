import { supabase } from '../../database/supabase';
import { env } from '../../config/env';
import { createAppError } from '../../middleware/error.middleware';
import type { RegisterPushTokenInput } from './notification.schema';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

export interface PushSendOptions {
  guaranteedRecipient?: boolean;
}

export class NotificationService {
  async registerPushToken(userId: string, input: RegisterPushTokenInput) {
    // Check if token already exists
    const { data: existing } = await supabase
      .from('push_tokens')
      .select('user_id, active, updated_at')
      .eq('token', input.token)
      .maybeSingle();

    if (existing && existing.user_id !== userId) {
      // Guard against late response from previous session:
      // If client timestamp is older than current token record, reject stale reactivation
      if (input.clientTimestamp) {
        const clientTime = new Date(input.clientTimestamp).getTime();
        const existingTime = new Date(existing.updated_at).getTime();
        if (!isNaN(clientTime) && !isNaN(existingTime) && clientTime < existingTime) {
          return existing;
        }
      }
    }

    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token: input.token,
          platform: input.platform,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
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

  async deactivatePushToken(userId: string, token: string) {
    const { error } = await supabase
      .from('push_tokens')
      .update({ active: false, updated_at: new Date().toISOString() })
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

  async sendPushNotification(
    userId: string,
    payload: PushPayload,
    options?: PushSendOptions
  ): Promise<boolean> {
    const tokens = await this.getPushTokens(userId);
    if (tokens.length === 0) return false;

    const isGuaranteed = options?.guaranteedRecipient ?? true;

    // Sanitize data payload: ensure minimal payload and attach recipientUserId for client verification
    const safeData: Record<string, unknown> = {
      ...(payload.data ?? {}),
      recipientUserId: userId,
    };
    delete safeData.password;
    delete safeData.email;
    delete safeData.token;
    delete safeData.accessToken;

    const messages = tokens.map((token) => ({
      to: token,
      title: isGuaranteed ? payload.title : '',
      body: isGuaranteed ? payload.body : 'Tienes una nueva notificación',
      data: safeData,
      badge: payload.badge,
      sound: 'default',
      channelId: 'default',
    }));

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (env.expoAccessToken) {
        headers['Authorization'] = `Bearer ${env.expoAccessToken}`;
      }

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.error('Expo push error:', response.status, await response.text());
        return false;
      }

      const result = await response.json() as {
        data?: Array<{
          status: string;
          message?: string;
          id?: string;
          details?: { error?: string };
        }>;
      };
      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          const item = result.data[i];
          const errorType = item.details?.error ?? item.message;
          if (item.status === 'error' && (errorType === 'DeviceNotRegistered' || errorType === 'InvalidCredentials')) {
            const failedToken = tokens[i];
            if (failedToken) {
              await supabase
                .from('push_tokens')
                .update({ active: false, updated_at: new Date().toISOString() })
                .eq('token', failedToken);
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

  async sendReminderNotification(
    userId: string,
    taskTitle: string,
    remindAt: string,
    data?: Record<string, unknown>,
    options?: PushSendOptions
  ) {
    const isGuaranteed = options?.guaranteedRecipient ?? true;
    const notification = await this.createNotification(
      userId,
      'Recordatorio',
      `Recordatorio: ${taskTitle}`,
      'reminder',
      data
    );

    await this.sendPushNotification(
      userId,
      {
        title: isGuaranteed ? 'Recordatorio' : '',
        body: isGuaranteed ? `Recordatorio: ${taskTitle}` : 'Tienes un recordatorio pendiente',
        data: { ...data, notificationId: notification.id },
      },
      { guaranteedRecipient: isGuaranteed }
    );

    return notification;
  }
}

export const notificationService = new NotificationService();
