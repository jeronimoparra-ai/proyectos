import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks';
import type { IconProps } from './types';

export function IconCalendar({
  size = 22,
  color,
  accessibilityLabel = 'Calendar',
  style,
}: IconProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.primary;

  return (
    <View
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="calendar-outline" size={size} color={iconColor} />
    </View>
  );
}
