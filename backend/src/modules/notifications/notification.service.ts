import { supabase } from '../../database/supabase';
import { env } from '../../config/env';
import { createAppError } from '../../middleware/error.middleware';
import type { RegisterPushTokenInput } from './notification.schema';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Defaults seguros: acepta valores con guiones bajos como separadores de miles
// (p.ej. '15_000') o números normales; nunca devuelve NaN.
function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const cleaned = raw.replace(/_/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}
const EXPO_DEFAULT_TIMEOUT_MS = numEnv('EXPO_SEND_TIMEOUT_MS', 15000);

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

// Resultado por token de un envío a Expo (fallo por token, no global).
export interface TokenResult {
  token: string;
  success: boolean;
  error: string | null;
  messageId: string | null;
}

export class NotificationService {
  // --- CREACIÓN del aviso interno (independiente de Expo) ---------------

  async createNotification(
    userId: string,
    title: string,
    body: string,
    type: string = 'general',
    data?: Record<string, unknown>
  ) {
    const response = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, body, type, data })
      .select()
      .single();

    const { data: notification, error } = response as { data: { id: string; [key: string]: unknown } | null; error: Error | null };

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return notification as { id: string; [key: string]: unknown };
  }

  // --- ENVÍO hacia Expo con timeout y manejo por token ---------------

  async sendPushNotificationWithTimeout(
    userId: string,
    payload: PushPayload,
    timeoutMs: number = EXPO_DEFAULT_TIMEOUT_MS
  ): Promise<TokenResult[]> {
    const tokens = await this.getPushTokens(userId);
    if (tokens.length === 0) return [];

    const messages = tokens.map((t) => ({
      to: t,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      badge: payload.badge,
      sound: 'default',
      channelId: 'default',
    }));

    // Inicializar resultado por token (todos fallidos hasta comprobar).
    const results: TokenResult[] = tokens.map((t) => ({
      token: t,
      success: false,
      error: null,
      messageId: null,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(messages),
        signal: controller.signal,
      });

      if (!response.ok) {
        for (let i = 0; i < tokens.length; i++) {
          results[i].error = `expo_status_${response.status}`;
        }
        console.error(
          `Expo error ${response.status} para ${tokens.length} tokens`
        );
        return results;
      }

      const result = await response.json() as {
        data?: Array<{ status: string; message?: string; id?: string }>;
      };

      if (result.data) {
        for (let i = 0; i < result.data.length; i++) {
          const item = result.data[i];
          const res = results[i] ?? null;
          if (!res) continue;

          if (item.status === 'ok') {
            res.success = true;
            res.messageId = item.id ?? null;
          } else if (item.status === 'error') {
            res.error = item.message ?? 'expo_error';
            // Receptor no registrado: desactivar el token de forma segura,
            // manteniendo el histórico de notificaciones.
            const errCode =
              (item as { details?: { error?: string } }).details?.error ?? item.message;
            if (errCode === 'DeviceNotRegistered') {
              await this.deactivateTokenSafely(tokens[i]);
            }
          }
        }
      }
      return results;
    } catch (error) {
      const isAbort =
        error instanceof Error && error.name === 'AbortError';
      for (let i = 0; i < tokens.length; i++) {
        results[i].error = isAbort ? 'expo_timeout' : 'expo_network';
      }
      console.error('Failed to send push notification (timeout/network):', error);
      return results;
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Compatibilidad T2: envío con garantía de privacidad -------------
  // Cumple las pruebas T2: sanitización de datos sensibles, recipientUserId
  // adjunto y fallback genérico cuando el destinatario no está garantizado.
  async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
    options: { guaranteedRecipient?: boolean } = {}
  ): Promise<TokenResult[]> {
    // Campos de cuenta que NUNCA deben salir en el payload.
    const SENSITIVE = new Set([
      'password',
      'email',
      'accessToken',
      'refreshToken',
      'token',
      'secret',
      'secretKey',
      'credentials',
      'authorization',
      'apiKey',
      'privateKey',
      'sessionToken',
    ]);
    const raw = payload.data ?? {};
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (SENSITIVE.has(key)) continue;
      data[key] = value;
    }
    data.recipientUserId = userId;

    const guaranteed = options.guaranteedRecipient !== false;
    const finalPayload: PushPayload = guaranteed
      ? { title: payload.title, body: payload.body, data }
      : {
          title: '',
          body: 'Tienes una nueva notificación',
          data,
        };

    return this.sendPushNotificationWithTimeout(userId, finalPayload);
  }

  // --- Desactivar un token de forma segura (mantener histórico) -------

  async deactivateTokenSafely(token: string): Promise<void> {
    const { error } = await supabase
      .from('push_tokens')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('token', token);

    if (error) console.error('No se pudo desactivar token:', error.message);
  }

  // --- Resultado de entrega sobre el aviso interno -------------------

  async recordDeliveryReceipt(
    notificationId: string,
    status: string,
    messageIds: string[],
    tokenResults: TokenResult[] = []
  ): Promise<void> {
    // Cargar datos actuales para preservarlos (sin borrar el aviso).
    const { data: existing, error: getErr } = await supabase
      .from('notifications')
      .select('data')
      .eq('id', notificationId)
      .single();

    if (getErr) {
      console.error('No se pudo leer data del aviso:', getErr.message);
      return;
    }

    const current = (existing?.data ?? {}) as Record<string, unknown>;
    const delivery = {
      status,
      messageIds,
      tokenResults: tokenResults.map(({ success, error, messageId }) => ({ success, error, messageId })),
      timestamp: new Date().toISOString(),
    };
    const merged = { ...current, delivery };

    const { error } = await supabase
      .from('notifications')
      .update({ data: merged })
      .eq('id', notificationId);

    if (error) console.error('No se pudo registrar recibo:', error.message);
  }

  // --- Flujo completo: CREACIÓN -> ACEPTACIÓN/RESULTADO -> RESULTADO ---

  /**
   * Envía un recordatorio completo:
   *   1. CREACIÓN del aviso interno (nota DB).
   *   2. ACEPTACIÓN / RESULTADO de entrega hacia Expo (timeout por
   *      token, recibos y desactivación de tokens DeviceNotRegistered).
   *   3. RESULTADO: registro del recibo sobre el aviso interno.
   *
   * Devuelve el aviso interno y el resultado por token. El worker marca
   * `sent_at` cuando Expo acepta al menos un token; no confirma entrega al dispositivo.
   */
  async sendReminderNotification(
    userId: string,
    taskTitle: string,
    remindAt: string,
    data?: Record<string, unknown>
  ) {
    const reminderId = typeof data?.reminderId === 'string' ? data.reminderId : undefined;
    const notification = reminderId ? await this.getOrCreateReminder(userId, reminderId, taskTitle, data) : await this.createNotification(
      userId,
      'Recordatorio',
      `Recordatorio: ${taskTitle}`,
      'reminder',
      data
    );

    const previousDelivery = (notification.data as { delivery?: { status?: string } } | undefined)?.delivery;
    if (previousDelivery?.status === 'accepted') {
      return { notification, tokenResults: [], delivered: true, accepted: true };
    }

    const tokenResults = await this.sendPushNotification(userId, {
      title: 'Recordatorio',
      body: taskTitle,
      data: {
        ...data,
        notificationId: (notification as { id: string }).id,
      },
    }, { guaranteedRecipient: false });

    const messageIds = tokenResults
      .filter((r) => r.success)
      .map((r) => r.messageId)
      .filter(Boolean) as string[];

    const delivered = tokenResults.some((r) => r.success);
    const notificationId = (notification as { id: string }).id;
    if (notificationId) {
      await this.recordDeliveryReceipt(
        notificationId,
        delivered ? 'accepted' : 'failed',
        messageIds,
        tokenResults
      );
    }

    // Legacy delivered boolean means provider acceptance, not device delivery.
    return { notification, tokenResults, delivered, accepted: delivered };
  }

  private async getOrCreateReminder(userId: string, reminderId: string, taskTitle: string, data?: Record<string, unknown>) {
    // Reuse the reminder UUID as notification PK: retries cannot create duplicates.
    const { error } = await supabase.from('notifications').upsert({
      id: reminderId, user_id: userId, title: 'Recordatorio',
      body: `Recordatorio: ${taskTitle}`, type: 'reminder', data,
    }, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    const result = await supabase.from('notifications').select('*').eq('id', reminderId).eq('user_id', userId).single();
    if (result.error || !result.data) throw createAppError('Reminder notification unavailable', 500, 'DB_ERROR');
    return result.data as { id: string; [key: string]: unknown };
  }

  // --- API existente (no modificada por T5) --------------------------

  async registerPushToken(userId: string, input: RegisterPushTokenInput) {
    const timestamp = input.clientTimestamp === undefined ? null : new Date(input.clientTimestamp);
    if (timestamp && !Number.isFinite(timestamp.getTime())) throw createAppError('Invalid client timestamp', 400, 'INVALID_INPUT');
    const { data, error } = await supabase.rpc('register_push_token_atomic', {
      p_user_id: userId,
      p_token: input.token,
      p_platform: input.platform,
      p_client_timestamp: timestamp?.toISOString() ?? null,
    }) as { data: Array<{ user_id: string; token: string; platform: string; active: boolean; updated_at: string }> | null; error: { message: string } | null };
    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    // Stale registration is an idempotent no-op, never another owner's record.
    return data?.[0] ?? { user_id: userId, token: input.token, platform: input.platform, active: false };
  }

  // --- Desvinculación idempotente al cerrar sesión (T2) ----------------
  // Igual que T2: scoped por (userId, token), marca active=false sin borrar.
  async deactivatePushToken(userId: string, token: string) {
    const { error } = await supabase
      .from('push_tokens')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
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
    return (data ?? []).map((t: { token: string }) => t.token);
  }

  async listNotifications(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    return (data ?? []) as Array<{ id: string; [key: string]: unknown }>;
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

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.expoAccessToken) {
      headers['Authorization'] = `Bearer ${env.expoAccessToken}`;
    }
    return headers;
  }
}

export const notificationService = new NotificationService();
