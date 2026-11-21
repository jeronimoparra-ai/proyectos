import * as Calendar from 'expo-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventService } from './event';

// Calendario del dispositivo: alternativa a Google OAuth (sin credenciales).
// En Android, los calendarios sincronizados con Google estan en el dispositivo,
// asi que leer/escribir aqui equivale a leer/escribir el Google Calendar del usuario.
// API nueva de Expo SDK 57 (no las variantes legacy *Async, que estan deprecadas).

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  location?: string;
}

export interface NewDeviceEvent {
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  location?: string;
}

export interface DeviceCalendarInfo {
  id: string;
  title: string;
  readOnly: boolean;
}

export interface SyncResult {
  synced: boolean;
  imported: number;
  skipped: number;
  reason?: string;
}

export const CALENDAR_STORAGE_KEYS = {
  SELECTED_CALENDAR_ID: '@productivity_selected_calendar_id',
  AUTO_SYNC_OPT_IN: '@productivity_calendar_auto_sync_opt_in',
};

let currentSelectedCalendarId: string | null = null;

export function getSelectedCalendarId(): string | null {
  return currentSelectedCalendarId;
}

export function setSelectedCalendarId(id: string | null): void {
  currentSelectedCalendarId = id;
  if (id) {
    AsyncStorage.setItem(CALENDAR_STORAGE_KEYS.SELECTED_CALENDAR_ID, id).catch(() => {});
  } else {
    AsyncStorage.removeItem(CALENDAR_STORAGE_KEYS.SELECTED_CALENDAR_ID).catch(() => {});
  }
}

export async function loadSelectedCalendarId(): Promise<string | null> {
  try {
    const saved = await AsyncStorage.getItem(CALENDAR_STORAGE_KEYS.SELECTED_CALENDAR_ID);
    if (saved) {
      currentSelectedCalendarId = saved;
    }
    return currentSelectedCalendarId;
  } catch {
    return currentSelectedCalendarId;
  }
}

export async function isAutoSyncEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(CALENDAR_STORAGE_KEYS.AUTO_SYNC_OPT_IN);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CALENDAR_STORAGE_KEYS.AUTO_SYNC_OPT_IN, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export async function hasCalendarPermission(): Promise<boolean> {
  try {
    const current = await Calendar.getCalendarPermissions();
    return !!current.granted;
  } catch {
    return false;
  }
}

export async function requestCalendarAccess(): Promise<boolean> {
  if (await hasCalendarPermission()) return true;

  // En algunos dispositivos el dialogo de permisos se descarta (back/gesto) y
  // la promesa nunca se resuelve: sin timeout la pantalla se queda en spinner.
  const PERMISSION_TIMEOUT_MS = 12000;
  const request = Calendar.requestCalendarPermissions().catch(() => null);
  const timeout = new Promise<null>((resolve) => {
    const timer = setTimeout(() => resolve(null), PERMISSION_TIMEOUT_MS);
    void timer;
  });
  const result = await Promise.race([request, timeout]);

  // Re-consultar el estado real: puede haberse concedido aunque el timeout ganara.
  return result?.granted === true || (await hasCalendarPermission());
}

async function allCalendars(): Promise<Calendar.ExpoCalendar[]> {
  return Calendar.getCalendars(Calendar.EntityTypes.EVENT);
}

export async function listCalendars(): Promise<DeviceCalendarInfo[]> {
  try {
    const granted = await hasCalendarPermission();
    if (!granted) return [];

    const calendars = await allCalendars();
    return calendars.map((calendar) => ({
      id: calendar.id,
      title: calendar.title || calendar.name || 'Untitled Calendar',
      readOnly: calendar.allowsModifications === false,
    }));
  } catch {
    return [];
  }
}

export async function listDeviceEvents(from: Date, to: Date): Promise<DeviceCalendarEvent[]> {
  const calendars = await allCalendars();
  if (calendars.length === 0) return [];

  // Lectura: se pueden leer calendarios de solo lectura.
  // Si hay un calendario seleccionado explicitamente por el usuario, filtramos por el.
  let targetCalendars = calendars;
  if (currentSelectedCalendarId) {
    const selected = calendars.find((calendar) => calendar.id === currentSelectedCalendarId);
    if (selected) {
      targetCalendars = [selected];
    }
  }

  const events = await Calendar.listEvents(targetCalendars, from, to);
  return events
    .filter((event) => !!event.title)
    .map((event) => ({
      id: event.id,
      title: event.title,
      startDate: new Date(event.startDate).toISOString(),
      endDate: new Date(event.endDate).toISOString(),
      notes: event.notes || undefined,
      location: event.location || undefined,
    }));
}

export async function createDeviceEvent(input: NewDeviceEvent): Promise<string> {
  const calendars = await allCalendars();

  let target: Calendar.ExpoCalendar | undefined;

  // Si hay un calendario seleccionado por el usuario, validar si permite modificaciones.
  if (currentSelectedCalendarId) {
    const selected = calendars.find((calendar) => calendar.id === currentSelectedCalendarId);
    if (selected) {
      if (selected.allowsModifications === false) {
        throw new Error('Cannot export to a read-only calendar.');
      }
      target = selected;
    }
  }

  // Si no hay calendario seleccionado o no se encontro, buscar uno editable.
  if (!target) {
    const editable = calendars.filter((calendar) => calendar.allowsModifications !== false);
    if (editable.length === 0) throw new Error('No editable calendar found on this device.');
    target = editable.find((calendar) => calendar.isPrimary) ?? editable[0];
  }

  const event = await target.createEvent({
    title: input.title,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.location ? { location: input.location } : {}),
  });

  return event.id;
}

export async function syncDeviceCalendarOnStartup(): Promise<SyncResult> {
  const optIn = await isAutoSyncEnabled();
  if (!optIn) {
    return { synced: false, imported: 0, skipped: 0, reason: 'Auto-sync opt-in is disabled' };
  }

  const hasPerm = await hasCalendarPermission();
  if (!hasPerm) {
    return { synced: false, imported: 0, skipped: 0, reason: 'Calendar permission not granted' };
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const from = new Date(Date.now() - 7 * DAY_MS);
  const to = new Date(Date.now() + 60 * DAY_MS);

  const deviceEvents = await listDeviceEvents(from, to);
  if (deviceEvents.length === 0) {
    return { synced: true, imported: 0, skipped: 0 };
  }

  const existing = await eventService.list({
    start_after: from.toISOString(),
    start_before: to.toISOString(),
    limit: 100,
  });

  const normalize = (date: string) => new Date(date).toISOString();
  const existingExternalIds = new Set(
    existing.events.map((e) => e.external_id).filter((id): id is string => !!id)
  );
  const existingIdentityKeys = new Set(
    existing.events.map((e) => `${e.title.trim().toLowerCase()}|${normalize(e.start_date)}`)
  );

  let imported = 0;
  let skipped = 0;

  for (const event of deviceEvents) {
    const identityKey = `${event.title.trim().toLowerCase()}|${normalize(event.startDate)}`;
    if (existingExternalIds.has(event.id) || existingIdentityKeys.has(identityKey)) {
      skipped++;
      continue;
    }

    await eventService.create({
      title: event.title,
      description: event.notes,
      start_date: event.startDate,
      end_date: event.endDate,
      location: event.location,
      external_id: event.id,
      source: 'local',
    });

    existingExternalIds.add(event.id);
    existingIdentityKeys.add(identityKey);
    imported++;
  }

  return { synced: true, imported, skipped };
}
