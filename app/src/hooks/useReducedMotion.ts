import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let globalReducedMotion: boolean | null = null;
const listeners = new Set<(reduced: boolean) => void>();
let subscriptionInitialized = false;

function initReduceMotion() {
  if (subscriptionInitialized) return;
  subscriptionInitialized = true;

  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      globalReducedMotion = enabled;
      listeners.forEach((l) => l(enabled));
    })
    .catch(() => {
      globalReducedMotion = false;
    });

  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
    globalReducedMotion = enabled;
    listeners.forEach((l) => l(enabled));
  });
}

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => globalReducedMotion ?? false);

  useEffect(() => {
    initReduceMotion();
    if (globalReducedMotion !== null) {
      setReduceMotion(globalReducedMotion);
    }
    const listener = (enabled: boolean) => setReduceMotion(enabled);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return reduceMotion;
}
