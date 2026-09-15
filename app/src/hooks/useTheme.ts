import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../theme';
import { useAppStore } from '../store';
import type { ColorScheme } from '../theme';

export function useTheme() {
  const deviceScheme = useColorScheme();
  const { colorScheme } = useAppStore();
  const insets = useSafeAreaInsets();

  const resolvedScheme: ColorScheme =
    colorScheme === 'system'
      ? deviceScheme === 'dark'
        ? 'dark'
        : 'light'
      : colorScheme;

  return {
    colorScheme: resolvedScheme,
    colors: colors[resolvedScheme],
    typography,
    spacing,
    borderRadius,
    isDark: resolvedScheme === 'dark',
    insets,
  };
}
