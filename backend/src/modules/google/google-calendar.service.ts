import { env } from '../../config/env';
import { supabase } from '../../database/supabase';
import { createAppError } from '../../middleware/error.middleware';

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  status: string;
}

interface GoogleCalendarResponse {
  items: GoogleEvent[];
  nextPageToken?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class GoogleCalendarService {
  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: `${env.frontendUrl ?? 'http://localhost:8081'}/google-callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      state: userId,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private async getAccessToken(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('google_access_token, google_refresh_token, google_token_expiry')
      .eq('user_id', userId)
      .single();

    if (error || !data?.google_access_token) {
      throw createAppError('Google Calendar not connected', 400, 'GOOGLE_NOT_CONNECTED');
    }

    if (data.google_token_expiry && new Date(data.google_token_expiry) < new Date()) {
      return this.refreshAccessToken(userId, data.google_refresh_token!);
    }

    return data.google_access_token;
  }

  private async refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw createAppError('Google token refresh timeout', 504, 'GOOGLE_TIMEOUT');
      }
      throw err;
    }

    if (!response.ok) {
      throw createAppError('Failed to refresh Google token', 401, 'GOOGLE_TOKEN_REFRESH_FAILED');
    }

    const data = await response.json() as GoogleTokenResponse;

    await supabase
      .from('user_preferences')
      .update({
        google_access_token: data.access_token,
        google_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      })
      .eq('user_id', userId);

    return data.access_token;
  }

  async handleOAuthCallback(code: string, userId: string) {
    let response: Response;
    try {
      response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: `${env.frontendUrl ?? 'http://localhost:8081'}/google-callback`,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw createAppError('Google auth code exchange timeout', 504, 'GOOGLE_TIMEOUT');
      }
      throw err;
    }

    if (!response.ok) {
      throw createAppError('Failed to exchange Google code', 401, 'GOOGLE_AUTH_FAILED');
    }

    const data = await response.json() as GoogleTokenResponse;

    const { error } = await supabase
      .from('user_preferences')
      .update({
        google_access_token: data.access_token,
        google_refresh_token: data.refresh_token,
        google_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Google Calendar connected successfully' };
  }

  async syncEvents(userId: string) {
    const accessToken = await this.getAccessToken(userId);
    let allEvents: GoogleEvent[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        maxResults: '100',
      });

      if (pageToken) params.append('pageToken', pageToken);

      let response: Response;
      try {
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
          }
        );
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
          throw createAppError('Google Calendar fetch timeout', 504, 'GOOGLE_TIMEOUT');
        }
        throw err;
      }

      if (!response.ok) {
        throw createAppError('Failed to fetch Google Calendar events', 500, 'GOOGLE_FETCH_FAILED');
      }

      const data = await response.json() as GoogleCalendarResponse;
      allEvents = [...allEvents, ...data.items];
      pageToken = data.nextPageToken;
    } while (pageToken);

    const eventsToSync = allEvents
      .filter((e) => e.status === 'confirmed')
      .map((e) => ({
        external_id: e.id,
        title: e.summary,
        description: e.description,
        start_date: e.start.dateTime ?? `${e.start.date}T00:00:00.000Z`,
        end_date: e.end.dateTime ?? `${e.end.date}T23:59:59.000Z`,
        all_day: !!e.start.date,
        location: e.location,
      }));

    const { eventService } = await import('../events/event.service');
    const result = await eventService.syncFromGoogle(userId, eventsToSync);

    return {
      message: 'Sync completed',
      ...result,
      total: allEvents.length,
    };
  }

  async disconnect(userId: string) {
    const { error } = await supabase
      .from('user_preferences')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
      })
      .eq('user_id', userId);

    if (error) throw createAppError(error.message, 500, 'DB_ERROR');

    return { message: 'Google Calendar disconnected' };
  }

  async isConnected(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_preferences')
      .select('google_access_token')
      .eq('user_id', userId)
      .single();

    return !!data?.google_access_token;
  }
}

export const googleCalendarService = new GoogleCalendarService();
