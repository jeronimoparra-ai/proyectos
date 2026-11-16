import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import type { IconChevronProps } from './types';

const CHEVRON_NAMES = {
  right: 'chevron-forward',
  left: 'chevron-back',
  up: 'chevron-up',
  down: 'chevron-down',
} as const;

export function IconChevron({
  size = 18,
  color,
  direction = 'right',
  accessibilityLabel,
  style,
}: IconChevronProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.primary;
  const label = accessibilityLabel ?? `Chevron ${direction}`;

  return (
    <View
      style={style}
      accessible={!!label}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Ionicons name={CHEVRON_NAMES[direction]} size={size} color={iconColor} />
    </View>
  );
}
