import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './useAuthStore';

const STORAGE_KEY = 'automation_preferences';

interface AutomationPreferences {
  remindersEnabled: boolean;
  silentStart: string; // HH:mm format
  silentEnd: string;   // HH:mm format
  snoozeMinutes: number;
}

const defaultPreferences: AutomationPreferences = {
  remindersEnabled: true,
  silentStart: '22:00',
  silentEnd: '07:00',
  snoozeMinutes: 10,
};

interface AutomationState {
  remindersEnabled: boolean;
  silentStart: string;
  silentEnd: string;
  snoozeMinutes: number;
  isLoading: boolean;
  setRemindersEnabled: (enabled: boolean) => Promise<void>;
  setSilentHours: (start: string, end: string) => Promise<void>;
  setSnoozeMinutes: (minutes: number) => Promise<void>;
  loadPreferences: () => Promise<void>;
  reset: () => void;
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY}_${userId}`;
}

async function loadFromStorage(userId: string): Promise<AutomationPreferences | null> {
  try {
    const stored = await AsyncStorage.getItem(getStorageKey(userId));
    if (stored) {
      return JSON.parse(stored) as AutomationPreferences;
    }
  } catch (error) {
    console.warn('[AutomationStore] Failed to load preferences:', error);
  }
  return null;
}

async function saveToStorage(userId: string, preferences: AutomationPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(preferences));
  } catch (error) {
    console.warn('[AutomationStore] Failed to save preferences:', error);
  }
}

async function clearStorage(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getStorageKey(userId));
  } catch (error) {
    console.warn('[AutomationStore] Failed to clear preferences:', error);
  }
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  remindersEnabled: defaultPreferences.remindersEnabled,
  silentStart: defaultPreferences.silentStart,
  silentEnd: defaultPreferences.silentEnd,
  snoozeMinutes: defaultPreferences.snoozeMinutes,
  isLoading: true,

  loadPreferences: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ isLoading: false });
      return;
    }

    const stored = await loadFromStorage(user.id);
    if (stored) {
      set({
        remindersEnabled: stored.remindersEnabled,
        silentStart: stored.silentStart,
        silentEnd: stored.silentEnd,
        snoozeMinutes: stored.snoozeMinutes,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  setRemindersEnabled: async (enabled: boolean) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ remindersEnabled: enabled });
    await saveToStorage(user.id, {
      remindersEnabled: enabled,
      silentStart: get().silentStart,
      silentEnd: get().silentEnd,
      snoozeMinutes: get().snoozeMinutes,
    });
  },

  setSilentHours: async (start: string, end: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Validate HH:mm format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      console.warn('[AutomationStore] Invalid time format, expected HH:mm');
      return;
    }

    set({ silentStart: start, silentEnd: end });
    await saveToStorage(user.id, {
      remindersEnabled: get().remindersEnabled,
      silentStart: start,
      silentEnd: end,
      snoozeMinutes: get().snoozeMinutes,
    });
  },

  setSnoozeMinutes: async (minutes: number) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    if (minutes < 1 || minutes > 60) {
      console.warn('[AutomationStore] Snooze minutes must be between 1 and 60');
      return;
    }

    set({ snoozeMinutes: minutes });
    await saveToStorage(user.id, {
      remindersEnabled: get().remindersEnabled,
      silentStart: get().silentStart,
      silentEnd: get().silentEnd,
      snoozeMinutes: minutes,
    });
  },

  reset: () => {
    set({
      remindersEnabled: defaultPreferences.remindersEnabled,
      silentStart: defaultPreferences.silentStart,
      silentEnd: defaultPreferences.silentEnd,
      snoozeMinutes: defaultPreferences.snoozeMinutes,
      isLoading: true,
    });
  },
}));

// Clear account data immediately when user changes
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) {
    if (previous.user?.id) {
      clearStorage(previous.user.id);
    }
    useAutomationStore.getState().reset();
    useAutomationStore.getState().loadPreferences();
  }
});