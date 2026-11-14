import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { calendarDatabase, databaseClient } from '../../../tests/support/calendar-db';
import type { PGlite } from '@electric-sql/pglite';
const mock = vi.hoisted(() => ({ client: null as any }));
vi.mock('../../database/supabase', () => ({ supabase: new Proxy({}, { get: (_, key) => mock.client[key] }) }));
vi.mock('../../config/env', () => ({ env: { googleClientId: 'test-client', googleClientSecret: 'test-only-secret', googleRedirectUri: 'http://localhost:8081/' } }));
import { GoogleCalendarService, mapGoogleEvent } from './google-calendar.service';
const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const redirect = 'http://localhost:8081/';
const scope = 'https://www.googleapis.com/auth/calendar.events.readonly';
const service = new GoogleCalendarService();
const google = vi.fn();
let db: PGlite;
let phase = 'events';
let refresh: string | undefined = 'refresh-1';
const allDay = { id: 'day', summary: 'Two days', status: 'confirmed', start: { date: '2026-11-13' }, end: { date: '2026-11-15' } };
async function begin() {
  return new URL(await service.getAuthUrl(user)).searchParams.get('state')!;
}
async function connect() { await service.handleOAuthCallback('code', user, await begin(), redirect); }

beforeAll(async () => {
  db = await calendarDatabase(); mock.client = databaseClient(db);
  await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2)', [user, other]);
}, 30000);
afterAll(async () => { vi.unstubAllGlobals(); await db?.close(); });
beforeEach(async () => {
  await db.exec('DELETE FROM calendar_oauth_states; DELETE FROM calendar_integrations; DELETE FROM events;');
  phase = 'events'; refresh = 'refresh-1'; google.mockReset();
  google.mockImplementation(async (url: string, init: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'access', refresh_token: refresh, expires_in: 3600, scope });
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://www.googleapis.com');
    expect(parsed.searchParams.get('showDeleted')).toBe('true');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access');
    if (phase === 'cancel') return Response.json({ items: [{ id: 'day', status: 'cancelled' }] });
    if (parsed.searchParams.get('pageToken')) return Response.json({ items: [{ id: 'timed', start: { dateTime: '2026-11-13T09:00:00-05:00', timeZone: 'America/Bogota' }, end: { dateTime: '2026-11-13T10:00:00-05:00' } }] });
    return Response.json({ items: [allDay], nextPageToken: 'page-2', timeZone: 'America/Bogota' });
  });
  vi.stubGlobal('fetch', google);
});

describe('OAuth with PostgreSQL and mocked Google APIs', () => {
  it('requests minimum scope, opaque unique state and exact configured redirect', async () => {
    const url = new URL(await service.getAuthUrl(user));
    expect(url.searchParams.get('scope')).toBe(scope);
    expect(url.searchParams.get('redirect_uri')).toBe(redirect);
    const state = url.searchParams.get('state')!;
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await begin()).not.toBe(state);
    const stored = await db.query<{ state_hash: string }>('SELECT state_hash FROM calendar_oauth_states');
    expect(stored.rows.every(row => row.state_hash !== state)).toBe(true);
  });
  it('connects and atomically rejects replay, wrong user, redirect, invalid and expired state', async () => {
    const state = await begin();
    await expect(service.handleOAuthCallback('code', other, state, redirect)).rejects.toMatchObject({ code: 'GOOGLE_INVALID_STATE' });
    await expect(service.handleOAuthCallback('code', user, state, `${redirect}evil`)).rejects.toMatchObject({ code: 'GOOGLE_INVALID_STATE' });
    await expect(service.handleOAuthCallback('code', user, 'x'.repeat(43), redirect)).rejects.toMatchObject({ code: 'GOOGLE_INVALID_STATE' });
    expect(google).not.toHaveBeenCalled();
    const attempts = await Promise.allSettled([service.handleOAuthCallback('code', user, state, redirect), service.handleOAuthCallback('code', user, state, redirect)]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await service.isConnected(user)).toBe(true);
    const expired = await begin();
    await db.exec("UPDATE calendar_oauth_states SET expires_at = now() - interval '1 minute'");
    await expect(service.handleOAuthCallback('code', user, expired, redirect)).rejects.toMatchObject({ code: 'GOOGLE_INVALID_STATE' });
  });
  it('requires refresh on connection/reconsent without corrupting previous credentials, persists rotation', async () => {
    refresh = undefined;
    await expect(connect()).rejects.toMatchObject({ code: 'GOOGLE_RECONNECT_REQUIRED' });
    expect(await service.isConnected(user)).toBe(false);
    refresh = 'refresh-1'; await connect(); refresh = undefined;
    await expect(connect()).rejects.toMatchObject({ code: 'GOOGLE_RECONNECT_REQUIRED' });
    let result = await db.query<{ refresh_token: string }>('SELECT refresh_token FROM calendar_integrations');
    expect(result.rows[0].refresh_token).toBe('refresh-1');
    await db.exec("UPDATE calendar_integrations SET token_expires_at = now() - interval '1 minute'");
    refresh = 'rotated'; await service.syncEvents(user);
    result = await db.query('SELECT refresh_token FROM calendar_integrations');
    expect(result.rows[0].refresh_token).toBe('rotated');
  });
  it('does not restore credentials if disconnect happens during token exchange', async () => {
    const state = await begin();
    google.mockImplementationOnce(async () => {
      await service.disconnect(user);
      return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope });
    });
    await expect(service.handleOAuthCallback('code', user, state, redirect)).rejects.toMatchObject({ code: 'GOOGLE_CONNECTION_CHANGED' });
    expect(await service.isConnected(user)).toBe(false);
  });
  it('makes invalid refresh actionable and allows clean reconnect', async () => {
    await connect();
    await db.exec("UPDATE calendar_integrations SET token_expires_at = now() - interval '1 minute'");
    google.mockResolvedValueOnce(Response.json({ error: 'invalid_grant' }, { status: 400 }));
    await expect(service.syncEvents(user)).rejects.toMatchObject({ code: 'GOOGLE_RECONNECT_REQUIRED' });
    expect(await service.isConnected(user)).toBe(false);
    await connect(); expect(await service.isConnected(user)).toBe(true);
  });
  it('imports pages twice/concurrently without duplicates, preserves exclusive days and zone, cancels, disconnects without deleting events', async () => {
    await connect();
    await Promise.all([service.syncEvents(user), service.syncEvents(user)]);
    expect((await db.query('SELECT * FROM events')).rows).toHaveLength(2);
    const day = (await db.query<any>("SELECT *, end_day - start_day AS days FROM events WHERE external_id = 'day'")).rows[0];
    expect(day.days).toBe(2);
    expect(day.end_date.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(day.time_zone).toBe('America/Bogota');
    const timed = (await db.query<any>("SELECT * FROM events WHERE external_id = 'timed'")).rows[0];
    expect(timed.start_date.toISOString()).toBe('2026-11-13T14:00:00.000Z');
    phase = 'cancel'; await service.syncEvents(user); await service.syncEvents(user);
    expect((await db.query('SELECT * FROM events WHERE deleted_at IS NULL')).rows).toHaveLength(1);
    const pending = await begin(); await service.disconnect(user);
    expect(await service.isConnected(user)).toBe(false);
    expect((await db.query('SELECT * FROM events')).rows).toHaveLength(2);
    await expect(service.handleOAuthCallback('code', user, pending, redirect)).rejects.toMatchObject({ code: 'GOOGLE_INVALID_STATE' });
  });
  it('enforces owner/calendar identity and database credential grants on fresh migrations', async () => {
    await connect(); await service.syncEvents(user);
    await db.query("INSERT INTO events(user_id,title,start_date,end_date,source,calendar_id,external_id) SELECT $1,title,start_date,end_date,source,calendar_id,external_id FROM events", [other]);
    await db.exec("INSERT INTO events(user_id,title,start_date,end_date,source,calendar_id,external_id) SELECT user_id,title,start_date,end_date,source,'other-calendar',external_id FROM events WHERE user_id = '11111111-1111-4111-8111-111111111111'");
    expect((await db.query('SELECT * FROM events')).rows).toHaveLength(6);
    await expect(db.exec("INSERT INTO events(user_id,title,start_date,end_date,source,calendar_id,external_id) SELECT user_id,title,start_date,end_date,source,calendar_id,external_id FROM events LIMIT 1")).rejects.toThrow(/duplicate key/);
    await db.exec('SET ROLE service_role');
    const integration = (await db.query<{ id: string }>('SELECT id FROM calendar_integrations')).rows[0];
    await expect(db.query('SELECT import_calendar_events($1, $2, $3)', [other, integration.id, '[]'])).rejects.toThrow(/disconnected/);
    await db.query('SELECT import_calendar_events($1, $2, $3)', [user, integration.id, '[]']);
    await db.exec('RESET ROLE');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      await expect(db.query('SELECT access_token FROM calendar_integrations')).rejects.toThrow(/permission denied/);
      await expect(db.query('SELECT * FROM calendar_oauth_states')).rejects.toThrow(/permission denied/);
      await expect(db.query('SELECT import_calendar_events($1, $2, $3)', [user, user, '[]'])).rejects.toThrow(/permission denied/);
      await db.exec('RESET ROLE');
    }
  });
  it('deletes imported recurring instances when Google cancels their parent series', async () => {
    await connect();
    google.mockResolvedValueOnce(Response.json({ items: [{ ...allDay, id: 'series_instance', recurringEventId: 'series' }] }));
    google.mockResolvedValueOnce(Response.json({ items: [] }));
    await service.syncEvents(user);
    google.mockResolvedValueOnce(Response.json({ items: [] }));
    google.mockResolvedValueOnce(Response.json({ items: [{ id: 'series', status: 'cancelled' }] }));
    await service.syncEvents(user);
    expect((await db.query('SELECT * FROM events WHERE deleted_at IS NULL')).rows).toHaveLength(0);
  });
  it('fails atomically on provider page failure and validates input', async () => {
    await connect();
    google.mockResolvedValueOnce(Response.json({ items: [allDay], nextPageToken: 'second' }));
    google.mockResolvedValueOnce(Response.json({}, { status: 503 }));
    await expect(service.syncEvents(user)).rejects.toMatchObject({ code: 'GOOGLE_FETCH_FAILED' });
    expect((await db.query('SELECT * FROM events')).rows).toHaveLength(0);
    await expect(service.handleOAuthCallback({}, user, 'bad', redirect)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(() => mapGoogleEvent({ id: 'bad', start: { date: 'bad' }, end: { date: 'bad' } })).toThrow();
  });
});

// The same date predicate used by month/week/day UI must preserve exclusive ends.
import { eventOccursOnDay } from '../../../tests/support/event-days';
it('renders floating all-day dates in every occupied day, excluding the last day', () => {
  const event = mapGoogleEvent(allDay);
  expect(eventOccursOnDay(event as any, new Date(2026, 10, 12))).toBe(false);
  expect(eventOccursOnDay(event as any, new Date(2026, 10, 13))).toBe(true);
  expect(eventOccursOnDay(event as any, new Date(2026, 10, 14))).toBe(true);
  expect(eventOccursOnDay(event as any, new Date(2026, 10, 15))).toBe(false);
});

import express from 'express';
import type { AddressInfo } from 'node:net';
import { googleCalendarRoutes } from './google-calendar.routes';
import { errorHandler } from '../../middleware/error.middleware';
const httpFetch = globalThis.fetch;
vi.mock('../../middleware/auth.middleware', () => ({
  authMiddleware(req: any, res: any, next: () => void) {
    if (req.headers.authorization !== 'Bearer test-session') return res.status(401).json({ error: 'Unauthorized' });
    req.userId = '11111111-1111-4111-8111-111111111111'; next();
  },
}));
it('serves authenticated connect/status/paginated sync/disconnect endpoints', async () => {
  const app = express(); app.use(express.json()); app.use('/api/google', googleCalendarRoutes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/google`;
  async function call(path: string, body?: unknown) {
    return httpFetch(`${base}/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer test-session', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  try {
    expect((await httpFetch(`${base}/status`)).status).toBe(401);
    const { url } = await (await call('auth-url')).json();
    const state = new URL(url).searchParams.get('state');
    expect((await call('callback', { code: 'code', state, redirectUri: redirect })).status).toBe(200);
    expect(await (await call('status')).json()).toEqual({ connected: true });
    expect((await call('callback', { code: 'code', state, redirectUri: redirect })).status).toBe(400);
    expect((await (await call('sync', {})).json()).imported).toBe(2);
    expect((await call('disconnect', {})).status).toBe(200);
    expect(await (await call('status')).json()).toEqual({ connected: false });
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
