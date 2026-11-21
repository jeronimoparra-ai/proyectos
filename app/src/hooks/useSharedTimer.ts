import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export type TimerPrecision = 'second' | 'minute';
type TimerListener = () => void;

export class SharedTimer {
  private intervalMs: number;
  private listeners = new Set<TimerListener>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private isAppActive = true;

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  private start() {
    if (this.intervalId !== null || !this.isAppActive || this.listeners.size === 0) {
      return;
    }
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  private stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        // Safe catch to protect other listeners
      }
    });
  }

  handleAppStateChange = (nextState: AppStateStatus) => {
    const isNowActive = nextState === 'active';
    if (isNowActive && !this.isAppActive) {
      this.isAppActive = true;
      // Immediate tick on returning to foreground
      this.tick();
      if (this.listeners.size > 0) {
        this.start();
      }
    } else if (!isNowActive && this.isAppActive) {
      this.isAppActive = false;
      this.stop();
    }
  };

  subscribe(listener: TimerListener): () => void {
    const isFirst = this.listeners.size === 0;
    this.listeners.add(listener);

    if (isFirst) {
      this.isAppActive = AppState.currentState === 'active';
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
      if (this.isAppActive) {
        this.start();
      }
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
        if (this.appStateSubscription) {
          this.appStateSubscription.remove();
          this.appStateSubscription = null;
        }
      }
    };
  }

  getListenerCount(): number {
    return this.listeners.size;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  reset() {
    this.stop();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.listeners.clear();
    this.isAppActive = true;
  }
}

export const secondSharedTimer = new SharedTimer(1000);
export const minuteSharedTimer = new SharedTimer(60000);

export function useSharedTimer(precision: TimerPrecision = 'minute'): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = precision === 'second' ? secondSharedTimer : minuteSharedTimer;
    return timer.subscribe(() => {
      setTick((prev) => (prev + 1) | 0);
    });
  }, [precision]);

  return tick;
}
