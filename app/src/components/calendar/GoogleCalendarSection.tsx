import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase';
import { useTheme } from '../../hooks/useTheme';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
async function calendarRequest<T>(path: string, body?: unknown): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error('Sign in before connecting Google Calendar.');
  const response = await fetch(`${baseUrl}/google/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Calendar request failed. Please retry.');
  return data as T;
}

// Mount in SettingsScreen. Callback parameters survive until Settings is opened.
export function GoogleCalendarSection() {
  const { colors } = useTheme();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const initialization = useRef<Promise<{ connected: boolean }> | null>(null);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (Platform.OS === 'web') {
        const url = new URL(window.location.href);
        const state = url.searchParams.get('state');
        const expected = window.sessionStorage.getItem('google-calendar-state');
        if (state && expected) {
          if (state !== expected) throw new Error('Google connection belongs to another flow. Start again.');
          const code = url.searchParams.get('code');
          const redirectUri = `${url.origin}${url.pathname}`;
          // Remove authorization code from browser history before sending it.
          window.history.replaceState({}, '', redirectUri);
          window.sessionStorage.removeItem('google-calendar-state');
          if (!code || url.searchParams.has('error')) throw new Error('Google connection cancelled. You can connect again.');
          await calendarRequest('callback', { code, state, redirectUri });
        }
      }
      return calendarRequest<{ connected: boolean }>('status');
    }
    initialization.current ??= initialize();
    void initialization.current
      .then(status => { if (active) setConnected(status.connected); })
      .catch(error => { if (active) setMessage((error as Error).message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function run(action: 'connect' | 'sync' | 'disconnect') {
    setBusy(true); setMessage('');
    try {
      if (action === 'connect') {
        if (Platform.OS !== 'web') throw new Error('Open the web app and Settings to connect Google Calendar. Then sync here.');
        const { url } = await calendarRequest<{ url: string }>('auth-url');
        const state = new URL(url).searchParams.get('state');
        if (!state) throw new Error('Invalid Google connection response.');
        window.sessionStorage.setItem('google-calendar-state', state);
        window.location.assign(url);
      } else {
        const result = await calendarRequest<{ message: string; imported?: number }>(action, {});
        setMessage(action === 'sync' ? `Imported ${result.imported ?? 0} events. Reopen Calendar to refresh.` : 'Disconnected. Imported events are preserved.');
        const status = await calendarRequest<{ connected: boolean }>('status');
        setConnected(status.connected);
      }
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <View style={{ margin: 16, padding: 16, gap: 12, backgroundColor: colors.surface, borderRadius: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Google Calendar</Text>
      <Text style={{ color: colors.textSecondary }}>{connected ? 'Connected · read-only import' : 'Not connected'}</Text>
      <Text style={{ color: colors.textSecondary }}>After Google returns, open Settings to finish connecting.</Text>
      {!!message && <Text accessibilityRole="alert" style={{ color: colors.text }}>{message}</Text>}
      {busy && <ActivityIndicator accessibilityLabel="Updating Google Calendar" />}
      {(connected ? ['connect', 'sync', 'disconnect'] as const : ['connect'] as const).map(action => (
        <TouchableOpacity key={action} accessibilityRole="button" disabled={busy}
          onPress={() => void run(action)}
          style={{ padding: 12, backgroundColor: colors.primary, borderRadius: 8, opacity: busy ? 0.5 : 1 }}>
          <Text style={{ color: '#fff' }}>{action === 'connect' ? (connected ? 'Reconnect Google' : 'Connect Google') : action === 'sync' ? 'Import events' : 'Disconnect'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
