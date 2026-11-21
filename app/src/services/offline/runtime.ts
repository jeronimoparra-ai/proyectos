import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../supabase';
import { OfflineEngine, type Session } from './engine';

export async function currentSession(): Promise<Session | null> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId || !supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== userId || useAuthStore.getState().user?.id !== userId) return null;
  return { userId, token: session.access_token };
}
export const offlineEngine = new OfflineEngine(AsyncStorage, currentSession);
// No polling/background service. Account changes immediately abort the active replay.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) {
    void offlineEngine.setUser(state.user?.id ?? null).catch(() => {});
  }
});
void offlineEngine.setUser(useAuthStore.getState().user?.id ?? null).catch(() => {});
