import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface SinglePermissionDetails {
  status: PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  explanation: string;
  request: () => Promise<boolean>;
  openSettings: () => Promise<void>;
}

export interface AppPermissionsState {
  calendar: SinglePermissionDetails;
  notifications: SinglePermissionDetails;
  loading: boolean;
  openSettings: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const PERMISSION_EXPLANATIONS = {
  calendar:
    'El acceso al calendario permite consultar e importar eventos de tu dispositivo a la aplicación y exportar tus tareas con fecha de vencimiento.',
  notifications:
    'El acceso a notificaciones permite enviarte recordatorios y avisos oportunos sobre tareas próximas a vencer y eventos programados.',
};

export async function openSystemSettings(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Linking.openSettings();
  }
}

export async function checkCalendarPermissionState(): Promise<{
  status: PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
}> {
  try {
    const res = await Calendar.getCalendarPermissions();
    return {
      status: (res.status as PermissionStatus) || (res.granted ? 'granted' : 'denied'),
      granted: !!res.granted,
      canAskAgain: res.canAskAgain ?? true,
    };
  } catch {
    return { status: 'undetermined', granted: false, canAskAgain: true };
  }
}

export async function requestCalendarPermissionAction(): Promise<boolean> {
  try {
    const res = await Calendar.requestCalendarPermissions();
    return !!res.granted;
  } catch {
    return false;
  }
}

export async function checkNotificationsPermissionState(): Promise<{
  status: PermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
}> {
  try {
    const res = await Notifications.getPermissionsAsync();
    return {
      status: (res.status as PermissionStatus) || (res.granted ? 'granted' : 'denied'),
      granted: !!res.granted,
      canAskAgain: res.canAskAgain ?? true,
    };
  } catch {
    return { status: 'undetermined', granted: false, canAskAgain: true };
  }
}

export async function requestNotificationsPermissionAction(): Promise<boolean> {
  try {
    const res = await Notifications.requestPermissionsAsync();
    return !!res.granted;
  } catch {
    return false;
  }
}

export interface DeepLinkParsed {
  type: 'task' | 'event' | 'unknown';
  id?: string;
  rawUrl: string;
}

export function parseDeepLinkUrl(url: string): DeepLinkParsed {
  if (!url) return { type: 'unknown', rawUrl: '' };
  const normalized = url.trim();
  const match = normalized.match(/^(?:productivityapp:\/\/|https?:\/\/[^/]+\/)(tasks?|events?)\/([^/?#]+)/i);
  if (!match) return { type: 'unknown', rawUrl: normalized };
  const prefix = match[1].toLowerCase();
  const type = prefix.startsWith('task') ? 'task' : 'event';
  return {
    type,
    id: match[2],
    rawUrl: normalized,
  };
}

export function buildDeepLinkUrl(type: 'task' | 'event', id: string): string {
  return `productivityapp://${type === 'task' ? 'tasks' : 'events'}/${id}`;
}

export function useAppPermissions(): AppPermissionsState {
  const [loading, setLoading] = useState<boolean>(true);
  const [calendarGranted, setCalendarGranted] = useState<boolean>(false);
  const [calendarStatus, setCalendarStatus] = useState<PermissionStatus>('undetermined');
  const [calendarCanAskAgain, setCalendarCanAskAgain] = useState<boolean>(true);

  const [notifGranted, setNotifGranted] = useState<boolean>(false);
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('undetermined');
  const [notifCanAskAgain, setNotifCanAskAgain] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const cal = await checkCalendarPermissionState();
      setCalendarGranted(cal.granted);
      setCalendarStatus(cal.status);
      setCalendarCanAskAgain(cal.canAskAgain);

      const notif = await checkNotificationsPermissionState();
      setNotifGranted(notif.granted);
      setNotifStatus(notif.status);
      setNotifCanAskAgain(notif.canAskAgain);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestCalendar = useCallback(async () => {
    const granted = await requestCalendarPermissionAction();
    await refresh();
    return granted;
  }, [refresh]);

  const requestNotifications = useCallback(async () => {
    const granted = await requestNotificationsPermissionAction();
    await refresh();
    return granted;
  }, [refresh]);

  return {
    loading,
    calendar: {
      status: calendarStatus,
      granted: calendarGranted,
      canAskAgain: calendarCanAskAgain,
      explanation: PERMISSION_EXPLANATIONS.calendar,
      request: requestCalendar,
      openSettings: openSystemSettings,
    },
    notifications: {
      status: notifStatus,
      granted: notifGranted,
      canAskAgain: notifCanAskAgain,
      explanation: PERMISSION_EXPLANATIONS.notifications,
      request: requestNotifications,
      openSettings: openSystemSettings,
    },
    openSettings: openSystemSettings,
    refresh,
  };
}
