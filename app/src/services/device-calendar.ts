import * as Calendar from 'expo-calendar';

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

export async function hasCalendarPermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissions();
  return current.granted;
}

export async function requestCalendarAccess(): Promise<boolean> {
  if (await hasCalendarPermission()) return true;
  const result = await Calendar.requestCalendarPermissions();
  return result.granted;
}

async function allCalendars(): Promise<Calendar.ExpoCalendar[]> {
  return Calendar.getCalendars(Calendar.EntityTypes.EVENT);
}

export async function listDeviceEvents(from: Date, to: Date): Promise<DeviceCalendarEvent[]> {
  // Lectura: se pueden leer calendarios de solo lectura; no hace falta que sean editables.
  const calendars = await allCalendars();
  if (calendars.length === 0) return [];

  const events = await Calendar.listEvents(calendars, from, to);
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
  // Escritura: NUNCA usar un calendario de solo lectura (lanzaria en Android).
  const calendars = await allCalendars();
  const editable = calendars.filter((calendar) => calendar.allowsModifications !== false);
  if (editable.length === 0) throw new Error('No editable calendar found on this device.');

  const target =
    editable.find((calendar) => calendar.isPrimary) ?? editable[0];

  const event = await target.createEvent({
    title: input.title,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.location ? { location: input.location } : {}),
  });

  return event.id;
}
