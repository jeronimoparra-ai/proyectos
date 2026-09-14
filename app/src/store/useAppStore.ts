import { create } from 'zustand';
import type { ColorScheme } from '../types';

interface AppState {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  isReady: boolean;
  setReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  colorScheme: 'system',
  isReady: false,

  setColorScheme: (colorScheme) => set({ colorScheme }),

  setReady: (isReady) => set({ isReady }),
}));
