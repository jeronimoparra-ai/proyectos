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
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, body, type, data })
      .select()
      .single();

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');
    const createdNotification = notification as { id: string; [key: string]: unknown };
    return createdNotification;
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

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(messages),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        for (let i = 0; i < tokens.length; i++) {
          results[i].error = `expo_status_${response.status}`;
        }
        console.error(
          `Expo error ${response.status} para ${tokens.length} tokens: ${body.slice(0, 500)}`
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
      tokenResults,
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
   * `sent_at` sólo cuando `delivered === true` (todo el lote).
   */
  async sendReminderNotification(
    userId: string,
    taskTitle: string,
    remindAt: string,
    data?: Record<string, unknown>
  ) {
    const notification = await this.createNotification(
      userId,
      'Recordatorio',
      `Recordatorio: ${taskTitle}`,
      'reminder',
      data
    );

    const tokenResults = await this.sendPushNotificationWithTimeout(userId, {
      title: 'Recordatorio',
      body: taskTitle,
      data: {
        ...data,
        notificationId: (notification as { id: string }).id,
      },
    });

    const messageIds = tokenResults
      .filter((r) => r.success)
      .map((r) => r.messageId)
      .filter(Boolean) as string[];

    const delivered = tokenResults.some((r) => r.success);
    const notificationId = (notification as { id: string }).id;
    if (notificationId) {
      await this.recordDeliveryReceipt(
        notificationId,
        delivered ? 'delivered' : 'failed',
        messageIds,
        tokenResults
      );
    }

    return { notification, tokenResults, delivered };
  }

  // --- API existente (no modificada por T5) --------------------------

  async registerPushToken(userId: string, input: RegisterPushTokenInput) {
    // Comprobación previa: si el token pertenece a otra cuenta, rechazar
    // la reactivación si el timestamp del cliente es anterior al registro actual (respuesta tardía).
    const { data: existing } = await supabase
      .from('push_tokens')
      .select('user_id, active, updated_at')
      .eq('token', input.token)
      .maybeSingle();

    if (existing && existing.user_id !== userId) {
      if (input.clientTimestamp) {
        const clientTime = new Date(input.clientTimestamp).getTime();
        const existingTime = new Date(existing.updated_at).getTime();
        if (!isNaN(clientTime) && !isNaN(existingTime) && clientTime < existingTime) {
          return existing;
        }
      }
    }

    // UNIQUE(token) global: onConflict debe apuntar a 'token' (no a 'user_id,token').
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
    const registeredToken = data as { user_id: string; token: string; platform: string; active: boolean; updated_at: string };
    return registeredToken;
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
