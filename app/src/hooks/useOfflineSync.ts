import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useOfflineStore } from '../store/useOfflineStore';
import { apiClient } from '../services/api';

/** Mount once near the authenticated root. Cleanup removes all lifecycle listeners. */
export function useOfflineSync() {
  const state = useOfflineStore();
  useEffect(() => {
    const sync = () => { void apiClient.syncOffline().catch(() => {}); };
    sync();
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') sync(); });
    // NetInfo is not installed in this app. Web has an online event; native uses
    // foreground transitions and successful fetches, plus bounded replay retries.
    const web = globalThis as typeof globalThis & {
      addEventListener?: (name: string, callback: () => void) => void;
      removeEventListener?: (name: string, callback: () => void) => void;
    };
    web.addEventListener?.('online', sync);
    return () => { subscription.remove(); web.removeEventListener?.('online', sync); };
  }, []);
  return state;
}
