import { create } from 'zustand';
import { offlineEngine } from '../services/offline/runtime';
import type { OfflineState } from '../services/offline/engine';
export type { OfflineOp } from '../services/offline/engine';

interface OfflineStore extends OfflineState {
  syncNow(): Promise<void>;
  resolveConflict(id: string, choice: 'local' | 'remote' | 'retry'): Promise<void>;
  clearForUser(): Promise<void>;
}
export const useOfflineStore = create<OfflineStore>(() => ({
  ...offlineEngine.state,
  syncNow: () => offlineEngine.syncNow(),
  resolveConflict: (id, choice) => offlineEngine.resolveConflict(id, choice),
  clearForUser: () => offlineEngine.clearForUser(),
}));
offlineEngine.subscribe(state => useOfflineStore.setState(state));
