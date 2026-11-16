import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { supabase, createServiceClient } from '../../database/supabase';

// Cliente interno de proceso (service_role) para integraciones del backend.
// Se crea perezosamente: nunca al importar el módulo (tests lo pueden mockear).
let internalServiceClient: ReturnType<typeof createServiceClient> | null = null;
function internalClient() {
  if (!internalServiceClient) internalServiceClient = createServiceClient();
  return internalServiceClient;
}
import { createAppError } from '../../middleware/error.middleware';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const reconnect = () => createAppError('Reconnect Google Calendar in Settings to renew access.', 409, 'GOOGLE_RECONNECT_REQUIRED');
interface GoogleEvent {
  id: string; recurringEventId?: string; status?: string; summary?: string; description?: string; location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}
interface Tokens { access_token: string; refresh_token?: string; expires_in: number; scope?: string }

function required(value: unknown, max: number, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw createAppError(`Invalid ${name}`, 400, 'INVALID_INPUT');
  }
}
function dbError(error: unknown) {
  if (error) throw createAppError('Calendar storage operation failed. Please retry.', 500, 'DB_ERROR');
}
export function mapGoogleEvent(event: GoogleEvent, calendarTimeZone?: string) {
  required(event.id, 255, 'event id');
  if (event.status === 'cancelled') return { external_id: event.id, status: 'cancelled' };
  const allDay = !!event.start?.date;
  const start = allDay ? `${event.start?.date}T00:00:00.000Z` : event.start?.dateTime;
  const end = allDay ? `${event.end?.date}T00:00:00.000Z` : event.end?.dateTime;
  if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
    throw createAppError('Google returned an invalid event interval.', 502, 'GOOGLE_INVALID_EVENT');
  }
  // Timed Google responses include their UTC offset; preserve it. Floating days
  // are also stored as dates, avoiding device-timezone conversion of all-day UI.
  if (!allDay && (!/(Z|[+-]\d{2}:\d{2})$/.test(start) || !/(Z|[+-]\d{2}:\d{2})$/.test(end))) {
    throw createAppError('Google event is missing its UTC offset.', 502, 'GOOGLE_INVALID_EVENT');
  }
  return {
    external_id: event.id, recurring_event_id: event.recurringEventId ?? null, status: event.status ?? 'confirmed', title: (event.summary || '(Untitled)').slice(0, 255),
    description: event.description ?? null, location: event.location?.slice(0, 255) ?? null,
    start_date: start, end_date: end, all_day: allDay,
    start_day: allDay ? event.start!.date : null, end_day: allDay ? event.end!.date : null,
    time_zone: event.start?.timeZone ?? calendarTimeZone ?? null,
  };
}

export class GoogleCalendarService {
  private redirectUri() {
    const uri = env.googleRedirectUri;
    let parsed: URL;
    try { parsed = new URL(uri); } catch { throw createAppError('Configure GOOGLE_REDIRECT_URI.', 503, 'GOOGLE_CONFIG'); }
    if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && parsed.hostname === 'localhost')) || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw createAppError('Configure an exact HTTPS Google redirect URI (HTTP localhost is allowed).', 503, 'GOOGLE_CONFIG');
    }
    return uri;
  }

  async getAuthUrl(userId: string): Promise<string> {
    if (!env.googleClientId || !env.googleClientSecret) throw createAppError('Google Calendar is not configured.', 503, 'GOOGLE_CONFIG');
    const redirectUri = this.redirectUri();
    const state = randomBytes(32).toString('base64url');
    // Expired challenges carry no value and are removed on each new flow.
    const cleanup = await internalClient().from('calendar_oauth_states').delete().eq('user_id', userId).lt('expires_at', new Date().toISOString());
    dbError(cleanup.error);
    const { error } = await internalClient().from('calendar_oauth_states').insert({
      state_hash: hash(state), user_id: userId, redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    dbError(error);
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: env.googleClientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
      state, access_type: 'offline', prompt: 'consent',
    })}`;
  }

  private async tokenRequest(params: Record<string, string>): Promise<Tokens> {
    const response = await this.request('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, ...params }),
    });
    if (!response.ok) {
      if (response.status >= 500 || response.status === 429) throw createAppError('Google is temporarily unavailable. Retry later.', 502, 'GOOGLE_UNAVAILABLE');
      throw reconnect();
    }
    const data = await response.json() as Tokens;
    if (!data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw createAppError('Invalid Google token response.', 502, 'GOOGLE_INVALID_RESPONSE');
    if (data.scope && !data.scope.split(' ').includes(SCOPE)) throw reconnect();
    return data;
  }

  private async request(url: string, init: RequestInit = {}) {
    try { return await fetch(url, { ...init, signal: AbortSignal.timeout(15000) }); }
    catch { throw createAppError('Google request failed or timed out. Please retry.', 502, 'GOOGLE_UNAVAILABLE'); }
  }

  private async connection(userId: string) {
    const { data, error } = await internalClient().from('calendar_integrations').select('*').eq('user_id', userId).eq('provider', 'google').maybeSingle();
    dbError(error);
    return data;
  }

  async handleOAuthCallback(code: unknown, userId: string, state: unknown, redirectUri: unknown) {
    required(code, 4096, 'code'); required(state, 128, 'state'); required(redirectUri, 2048, 'redirectUri');
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || redirectUri !== this.redirectUri()) throw createAppError('Invalid OAuth state or redirect.', 400, 'GOOGLE_INVALID_STATE');
    // UPDATE RETURNING atomically consumes the challenge, including across workers.
    const { data: challenge, error } = await internalClient().from('calendar_oauth_states').update({ consumed_at: new Date().toISOString() }).is('consumed_at', null)
      .eq('state_hash', hash(state)).eq('user_id', userId).eq('redirect_uri', redirectUri)
      .gt('expires_at', new Date().toISOString()).select('state_hash').maybeSingle();
    dbError(error);
    if (!challenge) throw createAppError('OAuth state expired or already used. Start connection again.', 400, 'GOOGLE_INVALID_STATE');
    const tokens = await this.tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
    // Never mix a new account's access token with a prior account's refresh token.
    const refreshToken = tokens.refresh_token;
    if (!refreshToken) throw reconnect();
    const saved = await internalClient().rpc('complete_calendar_connection', {
      p_user_id: userId, p_state_hash: hash(state), p_redirect_uri: redirectUri,
      p_tokens: { access_token: tokens.access_token, refresh_token: refreshToken,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString() },
    });
    if (saved.error) throw createAppError('Connection could not finish. Start Google connection again.', 409, 'GOOGLE_CONNECTION_CHANGED');
    return { message: 'Google Calendar connected successfully' };
  }

  async syncEvents(userId: string) {
    const connection = await this.connection(userId);
    if (!connection?.refresh_token || !connection.sync_enabled) throw reconnect();
    let accessToken = connection.access_token;
    if (!connection.token_expires_at || Date.parse(connection.token_expires_at) <= Date.now() + 60_000) {
      let tokens: Tokens;
      try { tokens = await this.tokenRequest({ refresh_token: connection.refresh_token, grant_type: 'refresh_token' }); }
      catch (error) {
        if ((error as { code?: string }).code === 'GOOGLE_RECONNECT_REQUIRED') {
          const invalidated = await internalClient().from('calendar_integrations').update({ sync_enabled: false })
            .eq('id', connection.id).eq('user_id', userId).eq('refresh_token', connection.refresh_token);
          dbError(invalidated.error);
        }
        throw error;
      }
      const saved = await internalClient().from('calendar_integrations').update({
        access_token: tokens.access_token, refresh_token: tokens.refresh_token || connection.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq('id', connection.id).eq('user_id', userId).eq('refresh_token', connection.refresh_token).select('id').maybeSingle();
      dbError(saved.error);
      if (!saved.data) throw createAppError('Connection changed during sync. Retry sync.', 409, 'GOOGLE_CONNECTION_CHANGED');
      accessToken = tokens.access_token;
    }
    const events = new Map<string, ReturnType<typeof mapGoogleEvent>>();
    // Expand occurrences in the existing -30/+90 day product window. A second,
    // unbounded cancellation pass catches deleted events that left that window.
    const now = Date.now();
    for (const cancellationsOnly of [false, true]) {
      const pages = new Set<string>();
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({ singleEvents: String(!cancellationsOnly), showDeleted: 'true', maxResults: '2500' });
        if (!cancellationsOnly) {
          params.set('timeMin', new Date(now - 30 * 86400000).toISOString());
          params.set('timeMax', new Date(now + 90 * 86400000).toISOString());
        }
        if (pageToken) params.set('pageToken', pageToken);
        const response = await this.request(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (response.status === 401 || response.status === 403) throw reconnect();
        if (!response.ok) throw createAppError('Unable to import Google events. Retry later.', 502, 'GOOGLE_FETCH_FAILED');
        const data = await response.json() as { items?: GoogleEvent[]; nextPageToken?: string; timeZone?: string };
        for (const event of data.items ?? []) {
          if (!cancellationsOnly || event.status === 'cancelled') events.set(event.id, mapGoogleEvent(event, data.timeZone));
        }
        pageToken = data.nextPageToken;
        if (pageToken && pages.has(pageToken)) throw createAppError('Google returned a repeated page.', 502, 'GOOGLE_INVALID_RESPONSE');
        if (pageToken) pages.add(pageToken);
      } while (pageToken);
    }
    const { data, error } = await internalClient().rpc('import_calendar_events', { p_user_id: userId, p_integration_id: connection.id, p_events: [...events.values()] });
    dbError(error);
    return { message: 'Sync completed', ...data, total: events.size };
  }

  async disconnect(userId: string) {
    const result = await internalClient().rpc('disconnect_calendar', { p_user_id: userId });
    dbError(result.error);
    // Imported events intentionally survive disconnection.
    return { message: 'Google Calendar disconnected' };
  }

  async isConnected(userId: string): Promise<boolean> {
    const data = await this.connection(userId);
    return !!(data?.refresh_token && data.sync_enabled);
  }
}
export const googleCalendarService = new GoogleCalendarService();
